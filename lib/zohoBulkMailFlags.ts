/**
 * Feature flags for moving bulk Influo mail Resend → Zoho Campaigns.
 * Default OFF everywhere except documented site_settings / LIVE env (ops turns on).
 * Never logs secrets. Test recipient defaults to nd.6@hotmail.com.
 */

import {
  shouldUseZohoForAnnouncements,
  zohoCampaignsCredentialsReady,
} from "@/lib/zohoCampaignsConfig";

function envOn(raw: string | undefined | null): boolean {
  return /^(1|true|yes)$/i.test(String(raw || "").trim());
}

/** Shared test inbox for dry-run / non-LIVE Zoho bulk paths. */
export function zohoBulkTestRecipient(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.ZOHO_BULK_TEST_RECIPIENT ||
    env.ZOHO_TEST_EMAIL ||
    env.ADMIN_EMAIL ||
    "nd.6@hotmail.com"
  )
    .trim()
    .toLowerCase();
}

/**
 * Category / related bulk + disk-queue drain.
 * ON when site_settings.zoho_campaigns_announcements=1 (same as announcements)
 * OR env CAMPAIGN_CATEGORY_ZOHO_ENABLED=1, and Zoho credentials are present.
 */
export function isCampaignCategoryZohoEnvEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return envOn(env.CAMPAIGN_CATEGORY_ZOHO_ENABLED);
}

export function shouldUseZohoForCategoryBulk(
  siteFlag: number | null | undefined,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (!zohoCampaignsCredentialsReady()) return false;
  if (isCampaignCategoryZohoEnvEnabled(env)) return true;
  return shouldUseZohoForAnnouncements(siteFlag);
}

/** When LIVE is off, Zoho category/strong-match sends only to the test recipient. */
export function isCampaignCategoryZohoLive(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return envOn(env.CAMPAIGN_CATEGORY_ZOHO_LIVE);
}

/** Strong-match outreach on publish (bulk Zoho instead of 1:1 Resend). Default OFF. */
export function isStrongMatchZohoEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return envOn(env.CAMPAIGN_STRONG_MATCH_ZOHO_ENABLED) && zohoCampaignsCredentialsReady();
}

export function isStrongMatchZohoLive(env: NodeJS.ProcessEnv = process.env): boolean {
  return envOn(env.CAMPAIGN_STRONG_MATCH_ZOHO_LIVE);
}

/** stats_updated batch via Zoho (generic body). Default OFF. */
export function isStatsUpdatedZohoEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return envOn(env.STATS_UPDATED_ZOHO_ENABLED) && zohoCampaignsCredentialsReady();
}

export function isStatsUpdatedZohoLive(env: NodeJS.ProcessEnv = process.env): boolean {
  return envOn(env.STATS_UPDATED_ZOHO_LIVE);
}

/** Top 10 congrats via Zoho when there are newcomers. Default OFF. */
export function isTop10CongratsZohoEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return envOn(env.TOP10_CONGRATS_ZOHO_ENABLED) && zohoCampaignsCredentialsReady();
}

export function isTop10CongratsZohoLive(env: NodeJS.ProcessEnv = process.env): boolean {
  return envOn(env.TOP10_CONGRATS_ZOHO_LIVE);
}

/**
 * Drop per-application admin Resend copy; queue for a daily admin digest instead.
 * Default OFF — brand/creator application mails stay on Resend either way.
 */
export function isAdminApplicationDigestEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return envOn(env.ADMIN_APPLICATION_DIGEST_ENABLED);
}

/** Max Zoho campaigns per category-queue drain tick (no flood). Default 3. */
export function categoryZohoDrainMaxCampaigns(
  env: NodeJS.ProcessEnv = process.env
): number {
  const n = Number(env.CAMPAIGN_CATEGORY_ZOHO_DRAIN_MAX || 3);
  if (!Number.isFinite(n) || n < 1) return 3;
  return Math.min(20, Math.floor(n));
}
