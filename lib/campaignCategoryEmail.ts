import fs from "node:fs";
import path from "node:path";
import { contactsFor, loadApprovedCreators } from "@/lib/campaignNotify";
import { campaignCategoryIsGeneral, presenceAllows, rankCampaignAlerts } from "@/lib/campaignAlert";
import { sharedCategoryKeys } from "@/lib/recommendations";
import { isProtectedTestAccount } from "@/lib/protectedAccount";
import { sendChecked, siteUrl } from "@/lib/proposalMail";
import { categoryTranslations } from "@/lib/categories";
import { getSiteSetting } from "@/lib/siteSettingsServer";
import { shouldUseZohoForAnnouncements } from "@/lib/zohoCampaignsConfig";
import { sendCampaignCategoryViaZoho } from "@/lib/zohoCampaignCategorySend";

/**
 * Adjacent categories: a campaign in the key also interests creators in these.
 * Kept small and audience-based (who would plausibly promote it).
 */
export const RELATED_CATEGORIES: Record<string, string[]> = {
  "Cars & Automotive": ["Tech & Gadgets", "Lifestyle", "Travel", "Sports & Athletes"],
  "Tech & Gadgets": ["Gaming & Esports", "Business & Finance", "Cars & Automotive", "Education & Coaching"],
  "Gaming & Esports": ["Tech & Gadgets", "Comedy & Entertainment"],
  "Fashion & Style": ["Beauty & Makeup", "Lifestyle"],
  "Beauty & Makeup": ["Fashion & Style", "Lifestyle", "Health & Fitness"],
  "Lifestyle": ["Fashion & Style", "Travel", "Food & Drink", "Home & Decor"],
  "Travel": ["Lifestyle", "Food & Drink", "Art & Photography"],
  "Food & Drink": ["Lifestyle", "Travel", "Health & Fitness"],
  "Health & Fitness": ["Sports & Athletes", "Food & Drink", "Beauty & Makeup"],
  "Sports & Athletes": ["Health & Fitness", "Lifestyle"],
  "Business & Finance": ["Education & Coaching", "Tech & Gadgets"],
  "Education & Coaching": ["Business & Finance", "Parenting & Family"],
  "Parenting & Family": ["Home & Decor", "Education & Coaching", "Pets & Animals"],
  "Home & Decor": ["DIY & Crafts", "Lifestyle", "Parenting & Family"],
  "DIY & Crafts": ["Home & Decor", "Art & Photography"],
  "Pets & Animals": ["Parenting & Family", "Lifestyle"],
  "Comedy & Entertainment": ["Music & Dance", "Gaming & Esports"],
  "Music & Dance": ["Comedy & Entertainment", "Art & Photography"],
  "Art & Photography": ["Travel", "DIY & Crafts", "Music & Dance"],
  "Sustainability & Eco": ["Lifestyle", "Home & Decor", "Food & Drink"],
};

/** ~30 emails/hour: one every 2 minutes. */
const GAP_MS = 2 * 60 * 1000;

/**
 * Queue state persisted to disk so a deploy/restart resumes it without double sends.
 * On the server cwd is /app, a bind mount of /opt/influo, which survives deploys.
 * `sent` holds `campaignId:influencerId` and `campaignId:email` keys of queued-or-sent jobs.
 */
const STATE_FILE = process.env.CAMPAIGN_MAIL_QUEUE_FILE || path.join(process.cwd(), ".data", "campaign-mail-queue.json");

type Job = { key: string; emailKey?: string; to: string; subject: string; html: string };
type State = { sent: Set<string>; queue: Job[]; running: boolean; loaded: boolean; day: string; sentToday: number; pausedDay: string };

/**
 * Bulk emails share the provider's daily quota (Resend free: 100/day) with transactional mail,
 * so the queue sends at most CAMPAIGN_BULK_DAILY_LIMIT per Athens day (default 70) and continues
 * the next day. A quota error stops the queue until the next day.
 */
const DAILY_LIMIT = Math.max(0, Number(process.env.CAMPAIGN_BULK_DAILY_LIMIT ?? 70) || 0);

function athensDay(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
const store = globalThis as unknown as { __influoCatMail?: State };
const state = (store.__influoCatMail ??= { sent: new Set<string>(), queue: [], running: false, loaded: false, day: "", sentToday: 0, pausedDay: "" });

function load(): void {
  if (state.loaded) return;
  state.loaded = true;
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as { sent?: string[]; queue?: Job[]; day?: string; sentToday?: number; pausedDay?: string };
    state.day = raw.day || "";
    state.sentToday = Number(raw.sentToday) || 0;
    state.pausedDay = raw.pausedDay || "";
    for (const k of raw.sent || []) state.sent.add(k);
    const known = new Set(state.queue.map((j) => j.key));
    for (const j of raw.queue || []) if (!known.has(j.key)) state.queue.push(j);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") console.error("[campaign category email] state load failed", err instanceof Error ? err.message : err);
  }
}

function save(): void {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    const tmp = `${STATE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ sent: [...state.sent], queue: state.queue, day: state.day, sentToday: state.sentToday, pausedDay: state.pausedDay }), { mode: 0o600 });
    fs.renameSync(tmp, STATE_FILE);
  } catch (err) {
    console.error("[campaign category email] state save failed", err instanceof Error ? err.message : err);
  }
}

/** Mark recipients already emailed outside this queue (e.g. a lost in-memory run). */
export function markCategoryEmailsSent(campaignId: string, emails: string[]): number {
  load();
  let added = 0;
  for (const e of emails) {
    const k = `${campaignId}:${e.trim().toLowerCase()}`;
    if (!state.sent.has(k)) {
      state.sent.add(k);
      added += 1;
    }
  }
  state.queue = state.queue.filter((j) => !j.emailKey || !emails.some((e) => j.emailKey === `${campaignId}:${e.trim().toLowerCase()}`));
  save();
  return added;
}

export function categoryQueueStatus(): { pending: number; sentKeys: number; day: string; sentToday: number; dailyLimit: number; pausedForQuota: boolean } {
  load();
  rollDay();
  return { pending: state.queue.length, sentKeys: state.sent.size, day: state.day, sentToday: state.sentToday, dailyLimit: DAILY_LIMIT, pausedForQuota: state.pausedDay === state.day };
}

/** Resume a persisted queue (called at boot). */
export function resumeCategoryEmailQueue(): void {
  load();
  if (state.queue.length) console.log("[campaign category email] resuming", state.queue.length);
  pump();
}

function rollDay(): void {
  const today = athensDay();
  if (state.day !== today) {
    state.day = today;
    state.sentToday = 0;
  }
}

/** Ms until shortly after the next Athens midnight (re-checked hourly so DST/clock drift can't stall it). */
function msUntilNextDay(): number {
  const now = Date.now();
  for (let h = 1; h <= 25; h++) if (athensDay(new Date(now + h * 3600_000)) !== state.day) return Math.min(h * 3600_000, 3600_000) + 5 * 60_000;
  return 3600_000;
}

function pump(): void {
  if (state.running) return;
  state.running = true;
  const tick = async () => {
    rollDay();
    const job = state.queue[0];
    if (!job) {
      state.running = false;
      return;
    }
    if (state.pausedDay === state.day || state.sentToday >= DAILY_LIMIT) {
      save();
      console.log("[campaign category email] daily cap/quota reached, continuing tomorrow", { pending: state.queue.length, sentToday: state.sentToday, limit: DAILY_LIMIT });
      setTimeout(tick, msUntilNextDay());
      return;
    }
    // Remove before sending: a crash mid-send skips one email rather than sending it twice.
    state.queue.shift();
    state.sentToday += 1;
    save();
    let outcome: "ok" | "quota" | "error" = "error";
    try {
      outcome = await sendChecked("campaign_category_creator", job.to, job.subject, job.html);
    } catch (err) {
      console.error("[campaign category email]", job.key, err instanceof Error ? err.message : "failed");
    }
    if (outcome === "quota") {
      // Not sent: put it back and stop until tomorrow.
      state.queue.unshift(job);
      state.pausedDay = state.day;
      save();
      console.warn("[campaign category email] provider quota reached, paused until tomorrow", { pending: state.queue.length });
      setTimeout(tick, msUntilNextDay());
      return;
    }
    if (outcome === "ok") console.log("[campaign category email] sent", job.key, { pending: state.queue.length, sentToday: state.sentToday });
    setTimeout(tick, state.queue.length ? GAP_MS : 0);
  };
  void tick();
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", facebook: "Facebook" };

export function buildCategoryCampaignEmail(input: { name: string; title: string; brandName: string; platforms: string[]; campaignId: string }) {
  const link = `${siteUrl()}/campaigns/${input.campaignId}`;
  const platforms = input.platforms.map((p) => PLATFORM_LABEL[p] || p).join(", ") || "—";
  return {
    subject: `Νέα καμπάνια στο Influo: ${input.title}`.slice(0, 150),
    html: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px;">
  <p>Γεια σου ${esc(input.name)},</p>
  <p>Άνοιξε νέα καμπάνια στο Influo που σχετίζεται με την κατηγορία σου.</p>
  <p><strong>Καμπάνια:</strong> ${esc(input.title)}<br/><strong>Επιχείρηση:</strong> ${esc(input.brandName)}<br/><strong>Πλατφόρμες:</strong> ${esc(platforms)}</p>
  <p><a href="${link}">${link}</a></p>
  <p style="color:#6b7280;font-size:12px;">Λαμβάνεις αυτό το email επειδή έχεις εγκεκριμένο προφίλ στο Influo.</p>
</div>`,
  };
}

/**
 * Queue a short email to approved, available creators in the campaign category (matched) or an
 * adjacent one (related). Skips creators already covered by the strong-match outreach, the test
 * account, and anyone already queued for this campaign. Returns counts queued.
 */
export async function queueCategoryCampaignEmails(c: {
  campaignId: string;
  title: string;
  brandName: string;
  category: string | null;
  location?: string | null;
  minFollowers?: number | null;
  platforms: string[];
  requiresPresence?: boolean | null;
  /** Also queue strong matches (used when re-deriving a lost queue). */
  includeStrong?: boolean;
  /** Strong matches that hit the 45s outreach budget — include in category queue (M4). */
  forceIncludeIds?: string[];
  /** Re-derive only: the first N recipients (same order as the lost run) were already emailed. */
  skipFirst?: number;
}): Promise<{ matched: number; related: number; skippedStrong: number; relatedCategories: string[]; via?: string }> {
  const category = (c.category || "").split(",").map((s) => s.trim()).filter(Boolean);
  const relatedCats = [...new Set(category.flatMap((k) => RELATED_CATEGORIES[k] || []))].filter((k) => !category.includes(k));
  const relatedLabel = relatedCats.map((k) => categoryTranslations[k]?.el || k);
  if (!category.length) return { matched: 0, related: 0, skippedStrong: 0, relatedCategories: relatedLabel, via: "no_category" };

  const creators = await loadApprovedCreators();
  const generalCampaign = campaignCategoryIsGeneral(c.category);
  const forceInclude = new Set((c.forceIncludeIds || []).map(String).filter(Boolean));
  const strong = new Set(
    rankCampaignAlerts(creators, { category: c.category, location: c.location, minFollowers: c.minFollowers, platforms: c.platforms, requiresPresence: c.requiresPresence })
      .filter((r) => r.strong)
      .map((r) => r.id)
  );
  const tier = new Map<string, "matched" | "related">();
  let skippedStrong = 0;
  for (const row of creators) {
    const status = (row as { availability_status?: string | null }).availability_status;
    if (status && status !== "available") continue;
    if (!presenceAllows(c, (row as { location?: string | null }).location)) continue;
    if (row.announcements_email_opted_out === true) continue;
    const id = String(row.id);
    // «Γενικά» = every approved creator is a category match (same as campaign alerts).
    if (generalCampaign || sharedCategoryKeys(c.category, row.category).length) {
      // M4: budget-skipped strong matches are not "covered" — put them in the category queue.
      if (strong.has(id) && !c.includeStrong && !forceInclude.has(id)) skippedStrong += 1;
      else tier.set(id, "matched");
    } else if (relatedCats.length && sharedCategoryKeys(relatedCats.join(","), row.category).length) {
      tier.set(id, "related");
    }
  }

  load();
  let matched = 0;
  let related = 0;
  let toSkip = Math.max(0, Math.floor(c.skipFirst || 0));
  const people = await contactsFor([...tier.keys()]);
  const jobs: Array<{ key: string; emailKey: string; to: string; subject: string; html: string; name: string; tier: "matched" | "related" }> = [];
  for (const person of people) {
    const email = (person.email || "").trim();
    if (!email.includes("@")) continue;
    if (isProtectedTestAccount({ display_name: person.name, contact_email: email })) continue;
    const key = `${c.campaignId}:${person.id}`;
    const emailKey = `${c.campaignId}:${email.toLowerCase()}`;
    if (state.sent.has(key) || state.sent.has(emailKey)) continue;
    if (toSkip > 0) {
      // Still mark as sent so a retry does not double-email the already-covered prefix.
      state.sent.add(key);
      state.sent.add(emailKey);
      toSkip -= 1;
      continue;
    }
    const mail = buildCategoryCampaignEmail({ name: person.name, title: c.title, brandName: c.brandName, platforms: c.platforms, campaignId: c.campaignId });
    const which = tier.get(person.id) === "matched" ? "matched" : "related";
    jobs.push({ key, emailKey, to: email, ...mail, name: person.name, tier: which });
    if (which === "matched") matched += 1;
    else related += 1;
  }

  if (!jobs.length) {
    console.log("[campaign category email] queued", c.campaignId, { matched, related, skippedStrong, relatedCategories: relatedCats, via: "empty" });
    save();
    return { matched, related, skippedStrong, relatedCategories: relatedLabel, via: "empty" };
  }

  // M3: Zoho temp-list bulk when admin flag ON; otherwise (or on failure) Resend disk queue.
  let via = "resend_queue";
  let useZoho = false;
  try {
    const flag = await getSiteSetting("zoho_campaigns_announcements");
    useZoho = shouldUseZohoForAnnouncements(flag);
  } catch (err) {
    console.warn("[campaign category email] zoho flag read failed; using Resend", err instanceof Error ? err.message : err);
  }

  if (useZoho) {
    const zoho = await sendCampaignCategoryViaZoho({
      campaignId: c.campaignId,
      title: c.title,
      brandName: c.brandName,
      contacts: jobs.map((j) => ({ email: j.to, displayName: j.name })),
      siteUrl: siteUrl(),
    }).catch((err) => ({
      ok: false as const,
      syncErrors: [] as string[],
      error: err instanceof Error ? err.message : String(err),
    }));
    if (zoho.ok) {
      for (const j of jobs) {
        state.sent.add(j.key);
        state.sent.add(j.emailKey);
      }
      save();
      via = "zoho";
      console.log("[campaign category email] zoho sent", c.campaignId, {
        matched,
        related,
        skippedStrong,
        subscribed: zoho.subscribed,
        relatedCategories: relatedCats,
      });
      return { matched, related, skippedStrong, relatedCategories: relatedLabel, via };
    }
    console.warn("[campaign category email] zoho failed → Resend queue", zoho.error, zoho.syncErrors?.slice(0, 3));
  }

  for (const j of jobs) {
    state.sent.add(j.key);
    state.sent.add(j.emailKey);
    state.queue.push({ key: j.key, emailKey: j.emailKey, to: j.to, subject: j.subject, html: j.html });
  }
  console.log("[campaign category email] queued", c.campaignId, { matched, related, skippedStrong, relatedCategories: relatedCats, via });
  save();
  pump();
  return { matched, related, skippedStrong, relatedCategories: relatedLabel, via };
}
