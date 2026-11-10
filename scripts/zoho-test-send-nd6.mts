/**
 * ONE-OFF: send a Zoho selected-recipient announcement ONLY to nd.6@hotmail.com,
 * wait until Sent, verify emails_sent_count=1, then run temp-list cleanup.
 *
 * Usage (on host with ZOHO_CAMPAIGNS_* env, after the delayed-delete fix is live):
 *   node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs \
 *     scripts/zoho-test-send-nd6.mts
 */

import assert from "node:assert/strict";
import {
  getZohoCampaignsEnv,
  zohoCampaignsCredentialsReady,
} from "../lib/zohoCampaignsConfig.ts";
import { clearZohoAccessTokenCache, zohoGetCampaignDetails } from "../lib/zohoCampaignsClient.ts";
import { sendAnnouncementViaZohoToSelected } from "../lib/zohoAnnouncementCampaign.ts";
import { processZohoTempListCleanup } from "../lib/zohoTempListCleanup.ts";

const ALLOWED = "nd.6@hotmail.com";
const testEmail = (process.env.ZOHO_TEST_EMAIL || ALLOWED).trim().toLowerCase();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  assert.equal(testEmail, ALLOWED, `Refusing: only ${ALLOWED} allowed (got ${testEmail})`);

  clearZohoAccessTokenCache();
  const env = getZohoCampaignsEnv();
  if (!zohoCampaignsCredentialsReady(env)) {
    throw new Error("ZOHO_CAMPAIGNS_* credentials incomplete — aborting");
  }

  console.log("[zoho-nd6] sending selected announcement ONLY to", testEmail);
  const result = await sendAnnouncementViaZohoToSelected({
    audience: "creators",
    contacts: [{ email: testEmail, displayName: "Nasos test" }],
    title: "Influo – δοκιμή ανακοίνωσης μέσω Zoho",
    siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(/\/$/, ""),
  });

  console.log("[zoho-nd6] send result", {
    ok: result.ok,
    campaignKey: result.campaignKey,
    listKey: result.listKey ? `${result.listKey.slice(0, 8)}…` : undefined,
    listDeleted: result.listDeleted,
    subscribed: result.subscribed,
    error: result.error,
    syncErrors: result.syncErrors,
  });

  if (!result.ok || !result.campaignKey) {
    throw new Error(`send failed: ${result.error || "no campaignKey"}`);
  }

  let emailsSent: number | null = null;
  let status = "";
  for (let i = 0; i < 24; i += 1) {
    await sleep(15_000);
    const details = await zohoGetCampaignDetails(result.campaignKey, env);
    status = details.status;
    emailsSent = details.emailsSentCount;
    console.log("[zoho-nd6] poll", { attempt: i + 1, status, emailsSent });
    if (status.toLowerCase().includes("sent") && emailsSent != null && emailsSent >= 1) break;
  }

  const cleanup = await processZohoTempListCleanup({ env });
  console.log("[zoho-nd6] cleanup", cleanup);
  console.log(
    "[zoho-nd6] VERDICT",
    JSON.stringify({
      campaignKey: result.campaignKey,
      status,
      emails_sent_count: emailsSent,
      ok: status.toLowerCase().includes("sent") && emailsSent === 1,
      listDeletedAfterCleanup: cleanup.deleted >= 1 || result.listDeleted === true,
    })
  );
}

main().catch((err) => {
  console.error("[zoho-nd6] FATAL", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
