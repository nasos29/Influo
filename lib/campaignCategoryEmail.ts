import { contactsFor, loadApprovedCreators } from "@/lib/campaignNotify";
import { rankCampaignAlerts } from "@/lib/campaignAlert";
import { sharedCategoryKeys } from "@/lib/recommendations";
import { isProtectedTestAccount } from "@/lib/protectedAccount";
import { send, siteUrl } from "@/lib/proposalMail";
import { categoryTranslations } from "@/lib/categories";

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

/** ~30 emails/hour: one every 2 minutes, in-process queue. */
const GAP_MS = 2 * 60 * 1000;

type Job = { key: string; to: string; subject: string; html: string };
const store = globalThis as unknown as { __influoCatMail?: { sent: Set<string>; queue: Job[]; running: boolean } };
const state = (store.__influoCatMail ??= { sent: new Set<string>(), queue: [], running: false });

function pump(): void {
  if (state.running) return;
  state.running = true;
  const tick = async () => {
    const job = state.queue.shift();
    if (!job) {
      state.running = false;
      return;
    }
    try {
      await send("campaign_category_creator", job.to, job.subject, job.html);
    } catch (err) {
      console.error("[campaign category email]", err instanceof Error ? err.message : "failed");
    }
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
}): Promise<{ matched: number; related: number; skippedStrong: number; relatedCategories: string[] }> {
  const category = (c.category || "").split(",").map((s) => s.trim()).filter(Boolean);
  const relatedCats = [...new Set(category.flatMap((k) => RELATED_CATEGORIES[k] || []))].filter((k) => !category.includes(k));
  const relatedLabel = relatedCats.map((k) => categoryTranslations[k]?.el || k);
  if (!category.length) return { matched: 0, related: 0, skippedStrong: 0, relatedCategories: relatedLabel };

  const creators = await loadApprovedCreators();
  const strong = new Set(
    rankCampaignAlerts(creators, { category: c.category, location: c.location, minFollowers: c.minFollowers, platforms: c.platforms })
      .filter((r) => r.strong)
      .map((r) => r.id)
  );
  const tier = new Map<string, "matched" | "related">();
  let skippedStrong = 0;
  for (const row of creators) {
    const status = (row as { availability_status?: string | null }).availability_status;
    if (status && status !== "available") continue;
    const id = String(row.id);
    if (sharedCategoryKeys(c.category, row.category).length) {
      if (strong.has(id)) skippedStrong += 1;
      else tier.set(id, "matched");
    } else if (relatedCats.length && sharedCategoryKeys(relatedCats.join(","), row.category).length) {
      tier.set(id, "related");
    }
  }

  let matched = 0;
  let related = 0;
  const people = await contactsFor([...tier.keys()]);
  for (const person of people) {
    const email = (person.email || "").trim();
    if (!email.includes("@")) continue;
    if (isProtectedTestAccount({ display_name: person.name, contact_email: email })) continue;
    const key = `${c.campaignId}:${person.id}`;
    if (state.sent.has(key)) continue;
    state.sent.add(key);
    const mail = buildCategoryCampaignEmail({ name: person.name, title: c.title, brandName: c.brandName, platforms: c.platforms, campaignId: c.campaignId });
    state.queue.push({ key, to: email, ...mail });
    if (tier.get(person.id) === "matched") matched += 1;
    else related += 1;
  }
  console.log("[campaign category email] queued", c.campaignId, { matched, related, skippedStrong, relatedCategories: relatedCats });
  pump();
  return { matched, related, skippedStrong, relatedCategories: relatedLabel };
}
