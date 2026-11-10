import { supabaseService } from "@/lib/apiAuth";
import { isTestBrand } from "@/lib/testAccounts";
import { notifyMatchingOpenCampaign } from "@/lib/campaignNotify";
import { publishedToBrand } from "@/lib/campaignMail";
import { campaignClosesAt } from "@/lib/campaignLifecycle";
import { getSiteSetting } from "@/lib/siteSettingsServer";
import { mailAdminEvent, send, siteUrl } from "@/lib/proposalMail";
import { queueCategoryCampaignEmails } from "@/lib/campaignCategoryEmail";
import { sendPushNewOpenCampaignToInfluencers } from "@/lib/push";
import { claimCampaignNotify } from "@/lib/campaignNotifyClaim";
import { addAdminNotice } from "@/lib/adminNotice";
import { isZeroCreatorReach } from "@/lib/campaignPendingApps";

/** Brand confirmation only right after opening (unless forced for a one-off resend). */
const BRAND_CONFIRM_WINDOW_MS = 15 * 60 * 1000;

/** Backup in-process guard (DB campaign_notify_log is the durable source of truth). */
const globalStore = globalThis as unknown as { __influoCampaignOpenings?: Set<string> };
const sentOpenings = (globalStore.__influoCampaignOpenings ??= new Set<string>());

type BrandRow = { brand_name?: string | null; contact_email?: string | null };

export type CampaignPublishedResult =
  | { ok: true; skipped: string }
  | {
      ok: true;
      admin: boolean;
      brand: boolean;
      creators: { emailed: number; pushed: number; inApp: number; matched: number; budgetSkipped: number };
      push: { sent: number; failed: number };
      categoryEmails: { matched: number; related: number; skippedStrong: number; relatedCategories: string[]; via?: string };
    }
  | { ok: false; error: string; status: number };

function platformList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

/**
 * Notifications for a campaign that just became open: matching creators (email/push/in-app),
 * admin email and brand confirmation. Reads with the service role; when `ownerId` is given the
 * campaign must belong to that brand. Idempotent per (campaign, opened_at) via DB + process Set.
 */
export async function notifyCampaignPublished(
  campaignId: string,
  opts: { ownerId?: string; force?: boolean } = {}
): Promise<CampaignPublishedResult> {
  const admin = supabaseService();
  const { data: row, error } = await admin
    .from("brand_campaigns")
    .select("id, brand_id, status, title, budget, category, location, requires_presence, min_followers, platforms, deadline, opened_at, created_at, brands ( brand_name, contact_email )")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) {
    console.error("[campaign published] read failed", campaignId, error.code, error.message);
    return { ok: false, error: "read_failed", status: 500 };
  }
  if (!row) {
    console.warn("[campaign published] not found", campaignId);
    return { ok: false, error: "Campaign not found", status: 404 };
  }
  if (opts.ownerId && row.brand_id !== opts.ownerId) return { ok: false, error: "Forbidden", status: 403 };
  if (row.status !== "open") return { ok: true, skipped: "not_open" };

  const openedAt = row.opened_at || row.created_at || "";
  const key = `${campaignId}:${openedAt}`;
  if (!opts.force && sentOpenings.has(key)) return { ok: true, skipped: "already_sent" };

  // Durable claim first (force skips so admin resend can re-run creator outreach).
  if (!opts.force) {
    const claimed = await claimCampaignNotify(campaignId, openedAt || new Date(0).toISOString(), "publish");
    if (!claimed) {
      sentOpenings.add(key);
      return { ok: true, skipped: "already_sent" };
    }
  }
  sentOpenings.add(key);

  const br = row.brands as BrandRow | BrandRow[] | null;
  const brand = Array.isArray(br) ? br[0] : br;
  const brandName = brand?.brand_name || "Brand";
  const brandEmail = (brand?.contact_email || "").trim().toLowerCase();

  // Test brand: admin + brand mails only; never push/email/in-app real creators.
  const testMode = await isTestBrand(row.brand_id, brandEmail);
  if (testMode) console.log("[campaign published] test brand: creator notifications skipped", campaignId);

  const creatorsJob = testMode
    ? Promise.resolve({
        emailed: 0,
        pushed: 0,
        inApp: 0,
        matched: 0,
        budgetSkipped: 0,
        matchedInfluencerIds: [] as string[],
        budgetSkippedIds: [] as string[],
      })
    : notifyMatchingOpenCampaign({
        campaignId,
        title: row.title,
        category: row.category || null,
        brandName,
        location: row.location || null,
        minFollowers: row.min_followers ?? null,
        platforms: platformList(row.platforms),
        requiresPresence: row.requires_presence === true,
      }).catch((err) => {
        console.error("[campaign published] creators notify", err);
        return {
          emailed: 0,
          pushed: 0,
          inApp: 0,
          matched: 0,
          budgetSkipped: 0,
          matchedInfluencerIds: [] as string[],
          budgetSkippedIds: [] as string[],
        };
      });

  // Public site URL, never the internal request origin (https → http port fails).
  const cronSecret = process.env.CRON_SECRET;
  const adminJob = fetch(`${siteUrl()}/api/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
    },
    body: JSON.stringify({ type: "campaign_published_admin", campaignId, campaignTitle: row.title, brandName, budget: row.budget }),
    signal: AbortSignal.timeout(12000),
  })
    .then(async (res) => {
      if (!res.ok) console.error("[campaign published] admin email API failed", res.status, (await res.text()).slice(0, 300));
      return res.ok;
    })
    .catch((err) => {
      console.error("[campaign published] admin email error", err instanceof Error ? err.message : err);
      return false;
    });

  const fresh = openedAt && Date.now() - new Date(openedAt).getTime() < BRAND_CONFIRM_WINDOW_MS;
  let brandJob: Promise<boolean> = Promise.resolve(false);
  if (brandEmail && (fresh || opts.force)) {
    let closesAt: string | null = null;
    try {
      const defaultDays = await getSiteSetting("campaign_default_days");
      closesAt = campaignClosesAt(
        {
          deadline: row.deadline ?? null,
          opened_at: row.opened_at ?? null,
          created_at: row.created_at || new Date().toISOString(),
        },
        { defaultDays }
      ).toISOString();
    } catch {
      closesAt = null;
    }
    const mail = publishedToBrand({ brandEmail, brandName, campaignTitle: row.title, campaignId, budget: row.budget, closesAt });
    brandJob = send("campaign_published_brand", brandEmail, mail.subject, mail.html)
      .then(() => true)
      .catch((err) => {
        console.error("[campaign published] brand email", err);
        return false;
      });
  }

  const [creators, adminOk, brandOk] = await Promise.all([creatorsJob, adminJob, brandJob]);

  // Q4: push only to matched creators (same set as in-app), not all approved.
  const push = testMode
    ? { sent: 0, failed: 0 }
    : await sendPushNewOpenCampaignToInfluencers({
        influencerIds: creators.matchedInfluencerIds,
        campaignTitle: row.title,
        brandName,
        campaignId,
      }).catch((err) => {
        console.error("[campaign published] push matched", err);
        return { sent: 0, failed: 0 };
      });

  // After strong-match outreach; budget-skipped strong matches go into the category queue (M4).
  const categoryEmails = testMode
    ? { matched: 0, related: 0, skippedStrong: 0, relatedCategories: [] as string[], via: "skipped_test" }
    : await queueCategoryCampaignEmails({
        campaignId,
        title: row.title,
        brandName,
        category: row.category || null,
        location: row.location || null,
        minFollowers: row.min_followers ?? null,
        platforms: platformList(row.platforms),
        requiresPresence: row.requires_presence === true,
        forceIncludeIds: creators.budgetSkippedIds,
      }).catch((err) => {
        console.error("[campaign published] category emails", err);
        return { matched: 0, related: 0, skippedStrong: 0, relatedCategories: [] as string[], via: "error" };
      });

  const categoryQueued = (categoryEmails.matched || 0) + (categoryEmails.related || 0);

  // Q1: zero-recipient alert for real (non-test) campaigns.
  if (
    isZeroCreatorReach({
      testBrand: testMode,
      inApp: creators.inApp,
      emailed: creators.emailed,
      categoryQueued,
    })
  ) {
    const detail = {
      campaignId,
      title: row.title,
      brandName,
      category: row.category || null,
      creatorsLoadedHint: creators.matched,
      inApp: creators.inApp,
      emailed: creators.emailed,
      categoryQueued,
      budgetSkipped: creators.budgetSkipped,
    };
    console.error("[campaign published] ZERO_RECIPIENTS", detail);
    await addAdminNotice({
      kind: "campaign_zero_recipients",
      title: `0 creator notify: ${brandName} — ${row.title}`.slice(0, 200),
      body: `inApp=${creators.inApp}, emailed=${creators.emailed}, categoryQueued=${categoryQueued}, matched=${creators.matched}`,
      url: "/admin",
      dedupeKey: `campaign_zero_recipients:${campaignId}:${openedAt || "na"}`,
    }).catch((err) => console.error("[campaign published] zero-recipient notice", err));
    await mailAdminEvent(
      "campaign_zero_recipients_admin",
      `ALERT: 0 creator notify — ${brandName}: ${row.title}`.slice(0, 180),
      "Καμπάνια δημοσιεύτηκε χωρίς recipients (in-app / email / category queue)",
      [
        ["Καμπάνια", row.title],
        ["Επιχείρηση", brandName],
        ["Category", row.category || "—"],
        ["inApp", creators.inApp],
        ["emailed", creators.emailed],
        ["categoryQueued", categoryQueued],
        ["matched", creators.matched],
        ["Campaign ID", campaignId],
      ]
    ).catch((err) => console.error("[campaign published] zero-recipient admin mail", err));
  }

  console.log("[campaign published] sent", campaignId, {
    admin: adminOk,
    brand: brandOk,
    creators: {
      emailed: creators.emailed,
      pushed: creators.pushed,
      inApp: creators.inApp,
      matched: creators.matched,
      budgetSkipped: creators.budgetSkipped,
    },
    push,
    categoryEmails,
  });
  return {
    ok: true,
    admin: adminOk,
    brand: brandOk,
    creators: {
      emailed: creators.emailed,
      pushed: creators.pushed,
      inApp: creators.inApp,
      matched: creators.matched,
      budgetSkipped: creators.budgetSkipped,
    },
    push,
    categoryEmails,
  };
}
