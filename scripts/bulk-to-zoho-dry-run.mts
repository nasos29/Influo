/**
 * Dry-run / safe ops helper for bulk Resend → Zoho migration.
 *
 * NEVER sends to real users. Any live Zoho call uses only nd.6@hotmail.com
 * when you pass --send-test (requires ZOHO_CAMPAIGNS_* on the host).
 *
 * Usage:
 *   npx tsx scripts/bulk-to-zoho-dry-run.mts
 *   npx tsx scripts/bulk-to-zoho-dry-run.mts --send-test
 *
 * Prints flag status, queue grouping preview, and optional one test Zoho campaign.
 * Does not print secrets.
 */

import {
  categoryQueueStatus,
  drainCategoryQueueViaZoho,
} from "../lib/campaignCategoryEmail.ts";
import {
  categoryZohoDrainMaxCampaigns,
  isAdminApplicationDigestEnabled,
  isCampaignCategoryZohoEnvEnabled,
  isCampaignCategoryZohoLive,
  isStatsUpdatedZohoEnabled,
  isStatsUpdatedZohoLive,
  isStrongMatchZohoEnabled,
  isStrongMatchZohoLive,
  isTop10CongratsZohoEnabled,
  isTop10CongratsZohoLive,
  shouldUseZohoForCategoryBulk,
  zohoBulkTestRecipient,
} from "../lib/zohoBulkMailFlags.ts";
import { zohoCampaignsCredentialsReady } from "../lib/zohoCampaignsConfig.ts";
import { adminApplicationDigestQueueStatus } from "../lib/adminApplicationDigest.ts";
import { flushStatsUpdatedViaZoho } from "../lib/statsUpdateEmail.ts";
import { sendZohoTempListCampaign } from "../lib/zohoTempListCampaign.ts";
import { statsUpdatedContentUrl, STATS_UPDATED_ZOHO_SUBJECT } from "../lib/zohoStatsUpdatedContent.ts";

function mask(value: string): string {
  if (!value) return "(empty)";
  if (value.length <= 6) return "***";
  return `${value.slice(0, 3)}…${value.slice(-2)} (len=${value.length})`;
}

async function main() {
  const sendTest = process.argv.includes("--send-test");
  const testTo = zohoBulkTestRecipient();

  console.log("=== Influo bulk → Zoho dry-run ===");
  console.log("test recipient:", testTo);
  console.log("credentials ready:", zohoCampaignsCredentialsReady());
  console.log("client id present:", mask(process.env.ZOHO_CAMPAIGNS_CLIENT_ID || ""));
  console.log("flags:", {
    CAMPAIGN_CATEGORY_ZOHO_ENABLED: isCampaignCategoryZohoEnvEnabled(),
    CAMPAIGN_CATEGORY_ZOHO_LIVE: isCampaignCategoryZohoLive(),
    categoryViaSiteOrEnv: shouldUseZohoForCategoryBulk(1), // assumes site flag ON for preview
    CAMPAIGN_STRONG_MATCH_ZOHO_ENABLED: isStrongMatchZohoEnabled(),
    CAMPAIGN_STRONG_MATCH_ZOHO_LIVE: isStrongMatchZohoLive(),
    STATS_UPDATED_ZOHO_ENABLED: isStatsUpdatedZohoEnabled(),
    STATS_UPDATED_ZOHO_LIVE: isStatsUpdatedZohoLive(),
    TOP10_CONGRATS_ZOHO_ENABLED: isTop10CongratsZohoEnabled(),
    TOP10_CONGRATS_ZOHO_LIVE: isTop10CongratsZohoLive(),
    ADMIN_APPLICATION_DIGEST_ENABLED: isAdminApplicationDigestEnabled(),
    drainMax: categoryZohoDrainMaxCampaigns(),
  });

  const status = categoryQueueStatus();
  console.log("category Resend queue:", status);

  // Preview grouping without reading raw emails into logs beyond counts.
  const drainPreview = await drainCategoryQueueViaZoho({ dryRun: true, maxCampaigns: 5 });
  console.log("category Zoho drain dry-run:", drainPreview);

  const statsFlush = await flushStatsUpdatedViaZoho({ dryRun: true });
  console.log("stats zoho queue dry-run:", statsFlush);

  console.log("admin application digest pending:", adminApplicationDigestQueueStatus());

  if (!sendTest) {
    console.log("Done (no Zoho API send). Pass --send-test to send ONE campaign to", testTo);
    return;
  }

  if (testTo !== "nd.6@hotmail.com" && !process.env.ZOHO_BULK_ALLOW_OTHER_TEST) {
    console.error("Refusing --send-test: recipient is not nd.6@hotmail.com");
    process.exit(1);
  }
  if (!zohoCampaignsCredentialsReady()) {
    console.error("ZOHO_CAMPAIGNS_* incomplete — aborting test send");
    process.exit(1);
  }

  const zoho = await sendZohoTempListCampaign({
    contacts: [{ email: testTo, displayName: "Influo dry-run" }],
    subject: `[dry-run] ${STATS_UPDATED_ZOHO_SUBJECT}`,
    contentUrl: statsUpdatedContentUrl(),
    label: "bulk-dry-run",
    audience: "creators",
  });
  console.log("test Zoho send:", {
    ok: zoho.ok,
    subscribed: zoho.subscribed,
    campaignKey: zoho.campaignKey ? `${String(zoho.campaignKey).slice(0, 6)}…` : undefined,
    error: zoho.error,
    syncErrors: zoho.syncErrors?.slice(0, 3),
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
