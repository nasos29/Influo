import { supabaseService } from "@/lib/apiAuth";
import { isTestBrand } from "@/lib/testAccounts";
import { notifyMatchingOpenCampaign } from "@/lib/campaignNotify";
import { publishedToBrand } from "@/lib/campaignMail";
import { campaignClosesAt } from "@/lib/campaignLifecycle";
import { send, siteUrl } from "@/lib/proposalMail";
import { queueCategoryCampaignEmails } from "@/lib/campaignCategoryEmail";
import { sendPushNewOpenCampaignToAllApprovedInfluencers } from "@/lib/push";

/** Brand confirmation only right after opening (unless forced for a one-off resend). */
const BRAND_CONFIRM_WINDOW_MS = 15 * 60 * 1000;

/** One send per opening per process, shared by every route bundle (save route + legacy client call). */
const globalStore = globalThis as unknown as { __influoCampaignOpenings?: Set<string> };
const sentOpenings = (globalStore.__influoCampaignOpenings ??= new Set<string>());

type BrandRow = { brand_name?: string | null; contact_email?: string | null };

export type CampaignPublishedResult =
  | { ok: true; skipped: string }
  | {
      ok: true;
      admin: boolean;
      brand: boolean;
      creators: { emailed: number; pushed: number; inApp: number };
      push: { sent: number; failed: number };
      categoryEmails: { matched: number; related: number; skippedStrong: number; relatedCategories: string[] };
    }
  | { ok: false; error: string; status: number };

function platformList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

/**
 * Notifications for a campaign that just became open: matching creators (email/push/in-app),
 * admin email and brand confirmation. Reads with the service role; when `ownerId` is given the
 * campaign must belong to that brand. Idempotent per (campaign, opened_at) within the process.
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
  if (sentOpenings.has(key)) return { ok: true, skipped: "already_sent" };
  sentOpenings.add(key);

  const br = row.brands as BrandRow | BrandRow[] | null;
  const brand = Array.isArray(br) ? br[0] : br;
  const brandName = brand?.brand_name || "Brand";
  const brandEmail = (brand?.contact_email || "").trim().toLowerCase();

  // Test brand: admin + brand mails only; never push/email/in-app real creators.
  const testMode = await isTestBrand(row.brand_id, brandEmail);
  if (testMode) console.log("[campaign published] test brand: creator notifications skipped", campaignId);

  const creatorsJob = testMode
    ? Promise.resolve({ emailed: 0, pushed: 0, inApp: 0 })
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
    return { emailed: 0, pushed: 0, inApp: 0 };
  });

  // Public site URL, never the internal request origin (https → http port fails).
  const adminJob = fetch(`${siteUrl()}/api/emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
      closesAt = campaignClosesAt({ deadline: row.deadline ?? null, opened_at: row.opened_at ?? null, created_at: row.created_at || new Date().toISOString() }).toISOString();
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

  // Push goes to every approved creator with a subscription (not only matches).
  const pushJob = testMode
    ? Promise.resolve({ sent: 0, failed: 0 })
    : sendPushNewOpenCampaignToAllApprovedInfluencers({ campaignTitle: row.title, brandName, campaignId }).catch((err) => {
    console.error("[campaign published] push all", err);
    return { sent: 0, failed: 0 };
  });

  const [creators, adminOk, brandOk, push] = await Promise.all([creatorsJob, adminJob, brandJob, pushJob]);
  // After the strong-match outreach, so those creators are not emailed twice.
  const categoryEmails = testMode
    ? { matched: 0, related: 0, skippedStrong: 0, relatedCategories: [] as string[] }
    : await queueCategoryCampaignEmails({
    campaignId,
    title: row.title,
    brandName,
    category: row.category || null,
    location: row.location || null,
    minFollowers: row.min_followers ?? null,
    platforms: platformList(row.platforms),
    requiresPresence: row.requires_presence === true,
  }).catch((err) => {
    console.error("[campaign published] category emails", err);
    return { matched: 0, related: 0, skippedStrong: 0, relatedCategories: [] as string[] };
  });
  console.log("[campaign published] sent", campaignId, { admin: adminOk, brand: brandOk, creators, push, categoryEmails });
  return { ok: true, admin: adminOk, brand: brandOk, creators, push, categoryEmails };
}
