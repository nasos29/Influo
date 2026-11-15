/**
 * Cron runner: brand draft reminders, no-campaign nudges, target/closed events.
 * Feature flag OFF by default. Non-live mode redirects all mail to the test inbox.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ageDays,
  BRAND_REMINDER_KINDS,
  brandOptedOutOfAnnouncementMail,
  brandOptedOutOfReminders,
  brandRemindersTestRecipient,
  CLOSED_EVENT_LOOKBACK_DAYS,
  draftReminderDue,
  EVENT_KINDS,
  hasRecentReminderRateLimit,
  isBrandRemindersEnabled,
  isBrandWeeklyNudgeZohoEnabled,
  isBrandWeeklyNudgeZohoLive,
  isWithinQuietSendWindow,
  noCampaignNudgeDue,
  REMINDER_RATE_LIMIT_KINDS,
  resolveSendTo,
  type BrandReminderKind,
} from "@/lib/brandCampaignReminders";
import { mailForKind, sendBrandReminderEmail } from "@/lib/brandCampaignReminderMail";
import { campaignSlotInfo } from "@/lib/campaignSlots";
import { sendPushToBrand } from "@/lib/push";
import { zohoCampaignsCredentialsReady } from "@/lib/zohoCampaignsConfig";
import { sendBrandWeeklyNudgeViaZoho } from "@/lib/zohoBrandWeeklyNudge";

export type ReminderCandidate = {
  kind: BrandReminderKind;
  brandId: string;
  brandName: string;
  brandEmail: string;
  campaignId?: string | null;
  campaignTitle?: string;
  slots?: number;
  filled?: number;
  applicationsCount?: number;
  acceptedCount?: number;
  reason: string;
};

export type BrandRemindersRunResult = {
  enabled: boolean;
  live: boolean;
  dryRun: boolean;
  quietHours: boolean;
  /** Weekly no-campaign nudge via Zoho Campaigns (separate flag). */
  zohoWeeklyEnabled: boolean;
  zohoWeeklyLive: boolean;
  zohoCredentialsReady: boolean;
  checked: {
    drafts: number;
    brands: number;
    openForSlots: number;
    closed: number;
  };
  due: ReminderCandidate[];
  /** Eligible no_campaign_nudge count (same rules; sent via Zoho when zohoWeeklyEnabled). */
  zohoNudgeDueCount: number;
  zohoNudge?: {
    ok: boolean;
    campaignKey?: string;
    listKey?: string;
    subscribed?: number;
    localOptOutMarked?: number;
    testOnly?: boolean;
    syncErrors?: string[];
    error?: string;
    loggedBrands?: number;
  };
  sent: Array<{
    kind: string;
    brandId: string;
    campaignId?: string | null;
    to: string;
    redirected: boolean;
    channel?: string;
  }>;
  skipped: string[];
  errors: string[];
};

type BrandRow = {
  id: string;
  brand_name: string | null;
  contact_email: string | null;
  reminders_email_opted_out?: boolean | null;
  announcements_email_opted_out?: boolean | null;
};

type CampaignRow = {
  id: string;
  brand_id: string;
  title: string | null;
  status: string | null;
  created_at: string;
  closed_at?: string | null;
  auto_closed?: boolean | null;
  slots?: number | null;
};

type LogRow = {
  brand_id: string;
  campaign_id: string | null;
  kind: string;
  created_at: string;
};

function pushCopy(kind: BrandReminderKind, title: string): { title: string; body: string } {
  switch (kind) {
    case "draft_day3":
      return { title: "Υπενθύμιση πρόχειρης καμπάνιας", body: `Δημοσιεύστε «${title}» ώστε να κάνουν αίτηση οι creators.` };
    case "draft_day10":
      return { title: "Τελευταία υπενθύμιση καμπάνιας", body: `Η «${title}» είναι ακόμα πρόχειρη.` };
    case "no_campaign_nudge":
      return { title: "Δημιουργήστε καμπάνια", body: "Ξεκινήστε μια ανοιχτή καμπάνια σε λίγα βήματα." };
    case "target_reached":
      return { title: "Συμπληρώθηκαν οι θέσεις", body: `Η «${title}» έφτασε τον στόχο creators.` };
    case "campaign_closed":
      return { title: "Η καμπάνια ολοκληρώθηκε", body: `Σύνοψη για «${title}» — δημιουργήστε νέα όταν είστε έτοιμοι.` };
    default:
      return { title: "Influo", body: title };
  }
}

async function claimLog(
  admin: SupabaseClient,
  row: {
    brand_id: string;
    campaign_id?: string | null;
    kind: string;
    channel?: string;
    meta?: Record<string, unknown>;
  }
): Promise<boolean> {
  const { error } = await admin.from("brand_reminder_log").insert({
    brand_id: row.brand_id,
    campaign_id: row.campaign_id || null,
    kind: row.kind,
    channel: row.channel || "email",
    meta: row.meta || null,
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  if (/brand_reminder_log|PGRST205|42P01|schema cache|reminders_email_opted_out|PGRST204|42703/i.test(error.message || "")) {
    console.warn("[brand-reminders] log table unavailable:", error.message);
    return false;
  }
  console.error("[brand-reminders] claim failed", error.message);
  return false;
}

async function releaseLog(
  admin: SupabaseClient,
  brandId: string,
  kind: string,
  campaignId?: string | null
): Promise<void> {
  let q = admin.from("brand_reminder_log").delete().eq("brand_id", brandId).eq("kind", kind);
  if (campaignId) q = q.eq("campaign_id", campaignId);
  else q = q.is("campaign_id", null);
  const { error } = await q;
  if (error) console.error("[brand-reminders] release failed", error.message);
}

export async function runBrandCampaignReminders(
  admin: SupabaseClient,
  opts?: {
    nowMs?: number;
    dryRun?: boolean;
    forceQuietBypass?: boolean;
    limit?: number;
    env?: NodeJS.ProcessEnv;
  }
): Promise<BrandRemindersRunResult> {
  const env = opts?.env || process.env;
  const nowMs = opts?.nowMs ?? Date.now();
  const dryRun = opts?.dryRun === true;
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
  const enabled = isBrandRemindersEnabled(env);
  const live = /^(1|true|yes)$/i.test(String(env.BRAND_CAMPAIGN_REMINDERS_LIVE || "").trim());
  const zohoWeeklyEnabled = isBrandWeeklyNudgeZohoEnabled(env);
  const zohoWeeklyLive = isBrandWeeklyNudgeZohoLive(env);
  const zohoReady = zohoCampaignsCredentialsReady();
  const quietHours = !isWithinQuietSendWindow(nowMs);
  const result: BrandRemindersRunResult = {
    enabled,
    live,
    dryRun,
    quietHours,
    zohoWeeklyEnabled,
    zohoWeeklyLive,
    zohoCredentialsReady: zohoReady,
    checked: { drafts: 0, brands: 0, openForSlots: 0, closed: 0 },
    due: [],
    zohoNudgeDueCount: 0,
    sent: [],
    skipped: [],
    errors: [],
  };

  // Resend path (drafts/events) needs ENABLED; Zoho weekly needs its own flag.
  // Dry-run lists everything even when both are off.
  if (!enabled && !zohoWeeklyEnabled && !dryRun) {
    result.skipped.push("feature_flag_off");
    return result;
  }

  if (quietHours && !dryRun && !opts?.forceQuietBypass) {
    result.skipped.push("quiet_hours_athens_10_19");
    return result;
  }

  // Brands
  let brands: BrandRow[] = [];
  {
    const first = await admin
      .from("brands")
      .select("id, brand_name, contact_email, reminders_email_opted_out, announcements_email_opted_out");
    if (first.error && /reminders_email_opted_out|announcements_email_opted_out|PGRST204|42703/i.test(first.error.message || "")) {
      const retry = await admin.from("brands").select("id, brand_name, contact_email, announcements_email_opted_out");
      if (retry.error && /announcements_email_opted_out|PGRST204|42703/i.test(retry.error.message || "")) {
        const bare = await admin.from("brands").select("id, brand_name, contact_email");
        if (bare.error) {
          result.errors.push(bare.error.message);
          return result;
        }
        brands = (bare.data || []) as BrandRow[];
      } else if (retry.error) {
        result.errors.push(retry.error.message);
        return result;
      } else {
        brands = (retry.data || []) as BrandRow[];
      }
    } else if (first.error) {
      result.errors.push(first.error.message);
      return result;
    } else {
      brands = (first.data || []) as BrandRow[];
    }
  }
  brands = brands.filter((b) => (b.contact_email || "").trim().includes("@"));
  result.checked.brands = brands.length;
  const brandById = new Map(brands.map((b) => [b.id, b]));

  // Campaigns for these brands
  const brandIds = brands.map((b) => b.id);
  const campaigns: CampaignRow[] = [];
  for (let i = 0; i < brandIds.length; i += 200) {
    const chunk = brandIds.slice(i, i + 200);
    const { data, error } = await admin
      .from("brand_campaigns")
      .select("id, brand_id, title, status, created_at, closed_at, auto_closed, slots")
      .in("brand_id", chunk);
    if (error && /auto_closed|slots|PGRST204|42703/i.test(error.message || "")) {
      const retry = await admin
        .from("brand_campaigns")
        .select("id, brand_id, title, status, created_at, closed_at")
        .in("brand_id", chunk);
      if (retry.error) {
        result.errors.push(retry.error.message);
        return result;
      }
      campaigns.push(...((retry.data || []) as CampaignRow[]));
    } else if (error) {
      result.errors.push(error.message);
      return result;
    } else {
      campaigns.push(...((data || []) as CampaignRow[]));
    }
  }

  const campaignsByBrand = new Map<string, CampaignRow[]>();
  for (const c of campaigns) {
    const list = campaignsByBrand.get(c.brand_id) || [];
    list.push(c);
    campaignsByBrand.set(c.brand_id, list);
  }

  // Reminder logs (recent + campaign-scoped)
  const logs: LogRow[] = [];
  for (let i = 0; i < brandIds.length; i += 100) {
    const chunk = brandIds.slice(i, i + 100);
    const { data, error } = await admin
      .from("brand_reminder_log")
      .select("brand_id, campaign_id, kind, created_at")
      .in("brand_id", chunk)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) {
      if (/brand_reminder_log|PGRST205|42P01|schema cache/i.test(error.message || "")) {
        result.skipped.push("brand_reminder_log_missing");
        if (!dryRun) return result;
      } else {
        result.errors.push(error.message);
        return result;
      }
    } else {
      logs.push(...((data || []) as LogRow[]));
    }
  }

  const logsByBrand = new Map<string, LogRow[]>();
  const logsByCampaignKind = new Set<string>();
  for (const row of logs) {
    const list = logsByBrand.get(row.brand_id) || [];
    list.push(row);
    logsByBrand.set(row.brand_id, list);
    if (row.campaign_id) logsByCampaignKind.add(`${row.campaign_id}::${row.kind}`);
  }

  const due: ReminderCandidate[] = [];

  // --- Events: target reached ---
  const openWithSlots = campaigns.filter((c) => String(c.status || "").toLowerCase() === "open");
  result.checked.openForSlots = openWithSlots.length;
  const slotInfo = await campaignSlotInfo(
    admin,
    openWithSlots.map((c) => c.id)
  );
  for (const c of openWithSlots) {
    const info = slotInfo[c.id];
    if (!info || info.slots == null || info.filled < info.slots) continue;
    if (logsByCampaignKind.has(`${c.id}::${BRAND_REMINDER_KINDS.targetReached}`)) continue;
    const brand = brandById.get(c.brand_id);
    if (!brand) continue;
    if (brandOptedOutOfAnnouncementMail(brand)) {
      result.skipped.push(`opt_out_event:${c.id}`);
      continue;
    }
    due.push({
      kind: BRAND_REMINDER_KINDS.targetReached,
      brandId: brand.id,
      brandName: brand.brand_name?.trim() || "Επιχείρηση",
      brandEmail: brand.contact_email!.trim().toLowerCase(),
      campaignId: c.id,
      campaignTitle: c.title || "Καμπάνια",
      slots: info.slots,
      filled: info.filled,
      reason: "slots_full",
    });
  }

  // --- Events: manually closed (lifecycle owns auto_closed immediate mail) ---
  const closed = campaigns.filter((c) => String(c.status || "").toLowerCase() === "closed");
  result.checked.closed = closed.length;
  const closedCandidates = closed.filter((c) => {
    if (c.auto_closed === true) return false;
    if (logsByCampaignKind.has(`${c.id}::${BRAND_REMINDER_KINDS.campaignClosed}`)) return false;
    const age = ageDays(c.closed_at || c.created_at, nowMs);
    return age != null && age <= CLOSED_EVENT_LOOKBACK_DAYS;
  });
  const closedAppCounts = new Map<string, { total: number; accepted: number }>();
  if (closedCandidates.length) {
    const ids = closedCandidates.map((c) => c.id);
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { data } = await admin.from("campaign_applications").select("campaign_id, status").in("campaign_id", chunk);
      for (const row of data || []) {
        const id = String((row as { campaign_id: string }).campaign_id);
        const cur = closedAppCounts.get(id) || { total: 0, accepted: 0 };
        cur.total += 1;
        if ((row as { status?: string }).status === "accepted") cur.accepted += 1;
        closedAppCounts.set(id, cur);
      }
    }
  }
  for (const c of closedCandidates) {
    const brand = brandById.get(c.brand_id);
    if (!brand) continue;
    if (brandOptedOutOfAnnouncementMail(brand)) {
      result.skipped.push(`opt_out_event:${c.id}`);
      continue;
    }
    const counts = closedAppCounts.get(c.id) || { total: 0, accepted: 0 };
    due.push({
      kind: BRAND_REMINDER_KINDS.campaignClosed,
      brandId: brand.id,
      brandName: brand.brand_name?.trim() || "Επιχείρηση",
      brandEmail: brand.contact_email!.trim().toLowerCase(),
      campaignId: c.id,
      campaignTitle: c.title || "Καμπάνια",
      applicationsCount: counts.total,
      acceptedCount: counts.accepted,
      reason: "manual_closed",
    });
  }

  // --- Reminder: draft day3 / day10 ---
  const drafts = campaigns.filter((c) => String(c.status || "").toLowerCase() === "draft");
  result.checked.drafts = drafts.length;
  for (const c of drafts) {
    const sentKinds = [...logsByCampaignKind]
      .filter((k) => k.startsWith(`${c.id}::`))
      .map((k) => k.split("::")[1]!);
    const kind = draftReminderDue({
      status: c.status,
      createdAt: c.created_at,
      sentKinds,
      nowMs,
    });
    if (!kind) continue;
    const brand = brandById.get(c.brand_id);
    if (!brand) continue;
    if (brandOptedOutOfReminders(brand)) {
      result.skipped.push(`opt_out_reminder:${brand.id}`);
      continue;
    }
    due.push({
      kind,
      brandId: brand.id,
      brandName: brand.brand_name?.trim() || "Επιχείρηση",
      brandEmail: brand.contact_email!.trim().toLowerCase(),
      campaignId: c.id,
      campaignTitle: c.title || "Καμπάνια",
      reason: kind === BRAND_REMINDER_KINDS.draftDay10 ? "draft_age_10d" : "draft_age_3d",
    });
  }

  // --- Reminder: no open campaign nudge ---
  for (const brand of brands) {
    if (brandOptedOutOfReminders(brand)) continue;
    const list = campaignsByBrand.get(brand.id) || [];
    const hasOpen = list.some((c) => String(c.status || "").toLowerCase() === "open");
    const lastCreated = list
      .map((c) => Date.parse(c.created_at))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)[0];
    const lastCampaignCreatedAt = lastCreated != null ? new Date(lastCreated).toISOString() : null;
    const brandLogs = logsByBrand.get(brand.id) || [];
    const nudgeAts = brandLogs
      .filter((r) => r.kind === BRAND_REMINDER_KINDS.noCampaignNudge)
      .map((r) => r.created_at);
    if (
      !noCampaignNudgeDue({
        hasOpenCampaign: hasOpen,
        lastCampaignCreatedAt,
        nudgeAts,
        nowMs,
      })
    ) {
      continue;
    }
    due.push({
      kind: BRAND_REMINDER_KINDS.noCampaignNudge,
      brandId: brand.id,
      brandName: brand.brand_name?.trim() || "Επιχείρηση",
      brandEmail: brand.contact_email!.trim().toLowerCase(),
      reason: "no_open_campaign",
    });
  }

  // Apply global reminder rate limit (events exempt). Prefer draft over nudge per brand.
  // When Zoho weekly is enabled, no_campaign_nudge is handled as one Zoho campaign (not Resend).
  const reminderDue = due.filter((d) => {
    if (!REMINDER_RATE_LIMIT_KINDS.has(d.kind)) return false;
    if (zohoWeeklyEnabled && d.kind === BRAND_REMINDER_KINDS.noCampaignNudge) return false;
    return true;
  });
  const nudgeDue = due.filter((d) => d.kind === BRAND_REMINDER_KINDS.noCampaignNudge);
  const eventDue = due.filter((d) => EVENT_KINDS.has(d.kind));
  const reminderPriority = (k: string) =>
    k === BRAND_REMINDER_KINDS.draftDay10 ? 0 : k === BRAND_REMINDER_KINDS.draftDay3 ? 1 : 2;
  reminderDue.sort((a, b) => reminderPriority(a.kind) - reminderPriority(b.kind));

  const selectedReminders: ReminderCandidate[] = [];
  const brandReminderPicked = new Set<string>();
  for (const cand of reminderDue) {
    if (brandReminderPicked.has(cand.brandId)) continue;
    const brandLogs = logsByBrand.get(cand.brandId) || [];
    if (hasRecentReminderRateLimit(brandLogs, nowMs)) {
      result.skipped.push(`rate_limit_7d:${cand.brandId}`);
      continue;
    }
    selectedReminders.push(cand);
    brandReminderPicked.add(cand.brandId);
  }

  // Zoho nudge list: same rate-limit / one-per-brand rules; exclude brands already picked for draft.
  const selectedNudges: ReminderCandidate[] = [];
  for (const cand of nudgeDue) {
    if (brandReminderPicked.has(cand.brandId)) continue;
    const brandLogs = logsByBrand.get(cand.brandId) || [];
    if (hasRecentReminderRateLimit(brandLogs, nowMs)) {
      result.skipped.push(`rate_limit_7d:${cand.brandId}`);
      continue;
    }
    selectedNudges.push(cand);
    brandReminderPicked.add(cand.brandId);
  }
  result.zohoNudgeDueCount = selectedNudges.length;

  const resendQueue = [...eventDue, ...selectedReminders].slice(0, limit);
  // When Zoho weekly is off, nudges still go through Resend (legacy path).
  const legacyNudgeQueue =
    !zohoWeeklyEnabled
      ? selectedNudges.slice(0, Math.max(0, limit - resendQueue.length))
      : [];
  const queueList = [...resendQueue, ...legacyNudgeQueue].slice(0, limit);

  result.due = dryRun
    ? [...eventDue, ...selectedReminders, ...selectedNudges]
    : [...queueList, ...(zohoWeeklyEnabled ? selectedNudges : [])];

  if (dryRun) {
    // List only — no send / no log writes (works even when feature flags are OFF).
    return result;
  }

  // --- Zoho weekly no-campaign nudge (one campaign for the eligible list) ---
  if (zohoWeeklyEnabled && selectedNudges.length > 0) {
    if (!zohoReady) {
      result.errors.push("zoho_credentials_missing");
      result.zohoNudge = {
        ok: false,
        error: "zoho_credentials_missing",
        syncErrors: [
          "Need ZOHO_CAMPAIGNS_CLIENT_ID/SECRET/REFRESH_TOKEN + LIST_KEY_CREATORS/BRANDS (+ TOPIC_ID recommended)",
        ],
      };
    } else {
      const testTo = brandRemindersTestRecipient(env);
      const contacts = zohoWeeklyLive
        ? selectedNudges.map((c) => ({
            email: c.brandEmail,
            displayName: c.brandName,
            brandId: c.brandId,
          }))
        : [{ email: testTo, displayName: "Influo test", brandId: undefined }];

      const zoho = await sendBrandWeeklyNudgeViaZoho({
        contacts,
        admin,
        siteUrl: (env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(/\/$/, ""),
      });

      result.zohoNudge = {
        ok: zoho.ok,
        campaignKey: zoho.campaignKey,
        listKey: zoho.listKey ? `${zoho.listKey.slice(0, 8)}…` : undefined,
        subscribed: zoho.subscribed,
        localOptOutMarked: zoho.localOptOutMarked,
        testOnly: !zohoWeeklyLive,
        syncErrors: zoho.syncErrors,
        error: zoho.error,
        loggedBrands: 0,
      };

      if (!zoho.ok) {
        result.errors.push(`zoho_nudge:${zoho.error || "send_failed"}`);
      } else if (zohoWeeklyLive) {
        // Log each eligible brand only when live (avoid rate-limiting without delivery).
        let logged = 0;
        for (const cand of selectedNudges) {
          const claimed = await claimLog(admin, {
            brand_id: cand.brandId,
            campaign_id: null,
            kind: cand.kind,
            channel: "zoho",
            meta: {
              reason: cand.reason,
              zohoCampaignKey: zoho.campaignKey || null,
              subscribed: zoho.subscribed ?? null,
            },
          });
          if (!claimed) {
            result.skipped.push(`claim_failed:zoho:${cand.brandId}`);
            continue;
          }
          logged += 1;
          result.sent.push({
            kind: cand.kind,
            brandId: cand.brandId,
            campaignId: null,
            to: cand.brandEmail,
            redirected: false,
            channel: "zoho",
          });
          const brandLogs = logsByBrand.get(cand.brandId) || [];
          brandLogs.unshift({
            brand_id: cand.brandId,
            campaign_id: null,
            kind: cand.kind,
            created_at: new Date(nowMs).toISOString(),
          });
          logsByBrand.set(cand.brandId, brandLogs);
        }
        result.zohoNudge.loggedBrands = logged;

        if (live) {
          for (const cand of selectedNudges) {
            const push = pushCopy(cand.kind, cand.brandName);
            await sendPushToBrand(cand.brandEmail, {
              title: push.title,
              body: push.body.slice(0, 120),
              url: "/brand/dashboard?tab=campaigns",
              tag: `brand-reminder-${cand.kind}-${cand.brandId}`,
            }).catch((err) => console.error("[brand-reminders] push", err));
          }
        }
      } else {
        result.sent.push({
          kind: BRAND_REMINDER_KINDS.noCampaignNudge,
          brandId: "test",
          campaignId: null,
          to: testTo,
          redirected: true,
          channel: "zoho",
        });
      }
    }
  }

  // --- Resend path: drafts + events (+ legacy nudge when Zoho off) ---
  if (!enabled) {
    if (eventDue.length > 0 || selectedReminders.length > 0 || legacyNudgeQueue.length > 0) {
      result.skipped.push("resend_flag_off");
    }
    return result;
  }

  for (const cand of queueList) {
    const claimed = await claimLog(admin, {
      brand_id: cand.brandId,
      campaign_id: cand.campaignId || null,
      kind: cand.kind,
      channel: "email",
      meta: { reason: cand.reason },
    });
    if (!claimed) {
      result.skipped.push(`claim_failed:${cand.kind}:${cand.campaignId || cand.brandId}`);
      continue;
    }

    const mail = mailForKind(cand.kind, {
      brandEmail: cand.brandEmail,
      brandName: cand.brandName,
      brandId: cand.brandId,
      campaignTitle: cand.campaignTitle,
      slots: cand.slots,
      filled: cand.filled,
      applicationsCount: cand.applicationsCount,
      acceptedCount: cand.acceptedCount,
    });
    const { to, redirected } = resolveSendTo(cand.brandEmail, env);
    const subject = redirected ? `[TEST ${cand.brandEmail}] ${mail.subject}` : mail.subject;
    const html = redirected
      ? `<p style="background:#fef3c7;border:1px solid #f59e0b;padding:8px 12px;border-radius:6px;font-size:12px;">TEST redirect — intended for <strong>${cand.brandEmail}</strong> (${cand.brandName})</p>${mail.html}`
      : mail.html;

    const sendResult = await sendBrandReminderEmail({
      type: `brand_reminder_${cand.kind}`,
      to,
      subject,
      html,
    });
    if (sendResult !== "ok") {
      await releaseLog(admin, cand.brandId, cand.kind, cand.campaignId);
      result.errors.push(`${cand.kind}:${cand.brandId}:send_${sendResult}`);
      continue;
    }

    // Push only when live — never notify real brand devices while redirecting mail to the test inbox.
    if (live && !redirected) {
      const push = pushCopy(cand.kind, cand.campaignTitle || cand.brandName);
      await sendPushToBrand(cand.brandEmail, {
        title: push.title,
        body: push.body.slice(0, 120),
        url: "/brand/dashboard?tab=campaigns",
        tag: `brand-reminder-${cand.kind}-${cand.campaignId || cand.brandId}`,
      }).catch((err) => console.error("[brand-reminders] push", err));
    }

    const brandLogs = logsByBrand.get(cand.brandId) || [];
    brandLogs.unshift({
      brand_id: cand.brandId,
      campaign_id: cand.campaignId || null,
      kind: cand.kind,
      created_at: new Date(nowMs).toISOString(),
    });
    logsByBrand.set(cand.brandId, brandLogs);
    if (cand.campaignId) logsByCampaignKind.add(`${cand.campaignId}::${cand.kind}`);

    result.sent.push({
      kind: cand.kind,
      brandId: cand.brandId,
      campaignId: cand.campaignId,
      to,
      redirected,
      channel: "email",
    });
  }

  return result;
}
