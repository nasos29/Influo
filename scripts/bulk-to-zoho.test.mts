import assert from "node:assert/strict";
import test from "node:test";
import {
  categoryZohoDrainMaxCampaigns,
  isAdminApplicationDigestEnabled,
  isCampaignCategoryZohoEnvEnabled,
  isCampaignCategoryZohoLive,
  isStatsUpdatedZohoEnabled,
  isStrongMatchZohoEnabled,
  isTop10CongratsZohoEnabled,
  shouldUseZohoForCategoryBulk,
  zohoBulkTestRecipient,
} from "../lib/zohoBulkMailFlags.ts";
import {
  campaignIdFromQueueKey,
  groupCategoryQueueByCampaign,
} from "../lib/campaignCategoryQueueHelpers.ts";
import {
  campaignCategoryContentUrl,
  campaignCategoryEmailHtml,
  campaignCategoryEmailSubject,
} from "../lib/zohoCampaignCategoryContent.ts";
import { uniqueZohoTempContacts } from "../lib/zohoTempListCampaign.ts";
import {
  buildAdminApplicationDigestHtml,
  enqueueAdminApplicationDigest,
} from "../lib/adminApplicationDigest.ts";
import { SITE_SETTING_META } from "../lib/siteSettings.ts";
import {
  STATS_UPDATED_ZOHO_SUBJECT,
  statsUpdatedContentUrl,
  statsUpdatedEmailHtml,
} from "../lib/zohoStatsUpdatedContent.ts";
import {
  TOP10_CONGRATS_ZOHO_SUBJECT,
  top10CongratsContentUrl,
  top10CongratsEmailHtml,
} from "../lib/zohoTop10Content.ts";

test("zoho bulk test recipient defaults to nd.6@hotmail.com", () => {
  assert.equal(zohoBulkTestRecipient({}), "nd.6@hotmail.com");
  assert.equal(
    zohoBulkTestRecipient({ ZOHO_BULK_TEST_RECIPIENT: "other@example.com" }),
    "other@example.com"
  );
});

test("feature flags default OFF", () => {
  const empty = {} as NodeJS.ProcessEnv;
  assert.equal(isCampaignCategoryZohoEnvEnabled(empty), false);
  assert.equal(isCampaignCategoryZohoLive(empty), false);
  assert.equal(isStrongMatchZohoEnabled(empty), false);
  assert.equal(isStatsUpdatedZohoEnabled(empty), false);
  assert.equal(isTop10CongratsZohoEnabled(empty), false);
  assert.equal(isAdminApplicationDigestEnabled(empty), false);
  assert.equal(shouldUseZohoForCategoryBulk(0, empty), false);
  assert.equal(shouldUseZohoForCategoryBulk(1, empty), false); // no creds in test env
});

test("category zoho env flag parses", () => {
  assert.equal(
    isCampaignCategoryZohoEnvEnabled({ CAMPAIGN_CATEGORY_ZOHO_ENABLED: "1" }),
    true
  );
  assert.equal(
    isCampaignCategoryZohoLive({ CAMPAIGN_CATEGORY_ZOHO_LIVE: "yes" }),
    true
  );
  assert.equal(categoryZohoDrainMaxCampaigns({}), 3);
  assert.equal(categoryZohoDrainMaxCampaigns({ CAMPAIGN_CATEGORY_ZOHO_DRAIN_MAX: "5" }), 5);
});

test("queue key → campaignId + group/dedupe", () => {
  const id = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
  assert.equal(campaignIdFromQueueKey(`${id}:inf-1`), id);
  assert.equal(campaignIdFromQueueKey("not-a-uuid:x"), null);
  const grouped = groupCategoryQueueByCampaign([
    { key: `${id}:a`, to: "A@Example.com" },
    { key: `${id}:b`, to: "a@example.com" },
    { key: `${id}:c`, to: "b@example.com" },
    { key: "bad:x", to: "c@example.com" },
  ]);
  assert.equal(grouped.size, 1);
  const bucket = grouped.get(id)!;
  assert.deepEqual(bucket.emails, ["a@example.com", "b@example.com"]);
  assert.equal(bucket.jobKeys.length, 3);
});

test("unique zoho contacts dedupe", () => {
  assert.deepEqual(
    uniqueZohoTempContacts([
      { email: "A@x.com", displayName: "A" },
      { email: "a@x.com", displayName: "A2" },
      { email: " ", displayName: "x" },
    ]),
    [{ email: "a@x.com", displayName: "A" }]
  );
});

test("category/strong content urls and html", () => {
  const id = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
  assert.match(campaignCategoryEmailSubject("Test"), /Test/);
  assert.equal(
    campaignCategoryContentUrl(id, "https://influo.gr", "category"),
    `https://influo.gr/api/public/zoho-campaign-content?campaignId=${id}`
  );
  assert.match(
    campaignCategoryContentUrl(id, "https://influo.gr/", "strong"),
    /kind=strong/
  );
  const cat = campaignCategoryEmailHtml({
    title: "T",
    brandName: "B",
    campaignId: id,
    siteUrl: "https://influo.gr",
  });
  assert.match(cat, /κατηγορία/);
  const strong = campaignCategoryEmailHtml({
    title: "T",
    brandName: "B",
    campaignId: id,
    siteUrl: "https://influo.gr",
    kind: "strong",
  });
  assert.match(strong, /ταιριάζει με το προφίλ/);
});

test("stats + top10 zoho content", () => {
  assert.match(STATS_UPDATED_ZOHO_SUBJECT, /στατιστικά/);
  assert.match(statsUpdatedContentUrl("https://influo.gr"), /zoho-stats-updated-content/);
  assert.match(statsUpdatedEmailHtml({ siteUrl: "https://influo.gr" }), /dashboard/);
  assert.match(TOP10_CONGRATS_ZOHO_SUBJECT, /Top 10/);
  assert.match(top10CongratsContentUrl("https://influo.gr"), /zoho-top10-congrats-content/);
  assert.match(top10CongratsEmailHtml({ siteUrl: "https://influo.gr" }), /Top 10/);
});

test("admin application digest builds html; enqueue respects flag", () => {
  const prev = process.env.ADMIN_APPLICATION_DIGEST_ENABLED;
  delete process.env.ADMIN_APPLICATION_DIGEST_ENABLED;
  assert.equal(
    enqueueAdminApplicationDigest({
      campaignTitle: "C",
      brandName: "B",
      influencerName: "I",
      proposedPrice: "10 €",
    }),
    false
  );
  const mail = buildAdminApplicationDigestHtml([
    {
      at: "2026-11-16T10:00:00.000Z",
      campaignTitle: "C",
      brandName: "B",
      influencerName: "I",
      proposedPrice: "10 €",
    },
  ]);
  assert.match(mail.subject, /1 νέα αίτηση/);
  assert.match(mail.html, /Influencer|I/);
  if (prev === undefined) delete process.env.ADMIN_APPLICATION_DIGEST_ENABLED;
  else process.env.ADMIN_APPLICATION_DIGEST_ENABLED = prev;
});

test("announcements site setting description mentions category bulk", () => {
  const desc = SITE_SETTING_META.zoho_campaigns_announcements.description;
  assert.match(desc.el, /category|κατηγορ/i);
  assert.match(desc.en, /category bulk/i);
  assert.match(desc.el, /Resend/i);
});
