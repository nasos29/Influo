/**
 * ONE-OFF: send a Zoho Campaigns announcement test to support@influo.gr only.
 *
 * Usage (on a host that has ZOHO_CAMPAIGNS_* env):
 *   node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs \
 *     scripts/zoho-test-send-support.mts
 *
 * Refuses to run unless TEST_EMAIL is support@influo.gr (hard-coded default).
 */

import assert from "node:assert/strict";
import {
  getZohoCampaignsEnv,
  zohoCampaignsCredentialsReady,
} from "../lib/zohoCampaignsConfig.ts";
import {
  clearZohoAccessTokenCache,
  zohoCreateCampaign,
  zohoCreateListWithContacts,
  zohoDeleteMailingList,
  zohoResponseOk,
  zohoSendCampaign,
} from "../lib/zohoCampaignsClient.ts";
import {
  ANNOUNCEMENT_EMAIL_SUBJECT,
  announcementContentUrl,
} from "../lib/zohoAnnouncementContent.ts";

const ALLOWED_TEST_EMAIL = "support@influo.gr";
const testEmail = (process.env.ZOHO_TEST_EMAIL || ALLOWED_TEST_EMAIL).trim().toLowerCase();

async function main() {
  assert.equal(
    testEmail,
    ALLOWED_TEST_EMAIL,
    `Refusing test send: only ${ALLOWED_TEST_EMAIL} is allowed (got ${testEmail})`
  );

  clearZohoAccessTokenCache();
  const env = getZohoCampaignsEnv();
  if (!zohoCampaignsCredentialsReady(env)) {
    throw new Error("ZOHO_CAMPAIGNS_* credentials incomplete — aborting test send");
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(/\/$/, "");
  const stamp = Date.now().toString(36);
  const listName = `Influo test support ${stamp}`.slice(0, 100);

  console.log("[zoho-test] creating temp list with ONLY", testEmail);
  console.log("[zoho-test] from_email=", env.fromEmail);
  const created = await zohoCreateListWithContacts(
    {
      listName,
      emails: [testEmail],
      description: "One-off Influo Zoho test — delete after send",
    },
    env
  );
  console.log("[zoho-test] listKey=", created.listKey);
  console.log(
    "[zoho-test] accepted=",
    created.acceptedEmails,
    "ignored=",
    created.ignoredEmails,
    "createRaw=",
    JSON.stringify(created.raw).slice(0, 400)
  );

  let campaignKey = "";
  let sendAccepted = false;
  let sendRaw: unknown = null;
  let deleteOk = false;
  let blockedReason = "";

  try {
    if (created.acceptedEmails.length === 0) {
      blockedReason =
        "Zoho ignored the only test contact (role/group addresses like support@ are often rejected as list contacts). No campaign sent; nobody else emailed.";
      console.warn("[zoho-test]", blockedReason);
    } else {
      const createdCampaign = await zohoCreateCampaign(
        {
          name: `Influo Zoho test ${stamp}`.slice(0, 180),
          subject: ANNOUNCEMENT_EMAIL_SUBJECT,
          listKey: created.listKey,
          contentUrl: announcementContentUrl("creators", siteUrl),
        },
        env
      );
      campaignKey = createdCampaign.campaignKey;
      console.log("[zoho-test] campaignKey=", campaignKey);

      sendRaw = await zohoSendCampaign(campaignKey, env);
      const msg = JSON.stringify(sendRaw).toLowerCase();
      sendAccepted =
        zohoResponseOk(sendRaw) || msg.includes("inprogress") || msg.includes("success");
      console.log(
        "[zoho-test] send accepted=",
        sendAccepted,
        "raw=",
        JSON.stringify(sendRaw).slice(0, 500)
      );
    }
  } finally {
    try {
      const delRaw = await zohoDeleteMailingList(
        created.listKey,
        { deleteContacts: false },
        env
      );
      deleteOk =
        zohoResponseOk(delRaw) || JSON.stringify(delRaw).toLowerCase().includes("deleted");
      console.log("[zoho-test] temp list deleted=", deleteOk);
    } catch (err) {
      console.warn(
        "[zoho-test] temp list delete failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const summary = {
    ok: sendAccepted,
    testEmail,
    fromEmail: env.fromEmail,
    listKey: created.listKey,
    acceptedEmails: created.acceptedEmails,
    ignoredEmails: created.ignoredEmails,
    campaignKey,
    sendAccepted,
    blockedReason: blockedReason || undefined,
    listDeleted: deleteOk,
    sendRawPreview: sendRaw ? JSON.stringify(sendRaw).slice(0, 400) : undefined,
  };
  console.log("[zoho-test] SUMMARY", JSON.stringify(summary, null, 2));
  if (!sendAccepted) process.exitCode = 1;
}

main().catch((err) => {
  console.error("[zoho-test] FATAL", err);
  process.exitCode = 1;
});
