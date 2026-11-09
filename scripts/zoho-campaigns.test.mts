import assert from "node:assert/strict";
import test from "node:test";
import {
  extractEmailsFromZohoListContacts,
  extractZohoCampaignKey,
  zohoResponseOk,
} from "../lib/zohoCampaignsClient.ts";
import {
  isZohoAnnouncementsFlagOn,
  shouldUseZohoForAnnouncements,
  zohoCampaignsCredentialsReady,
  type ZohoCampaignsEnv,
} from "../lib/zohoCampaignsConfig.ts";
import {
  announcementContentUrl,
  announcementEmailHtml,
  dashboardPathForAudience,
} from "../lib/zohoAnnouncementContent.ts";

test("zoho announcements flag defaults off", () => {
  assert.equal(isZohoAnnouncementsFlagOn(0), false);
  assert.equal(isZohoAnnouncementsFlagOn(undefined), false);
  assert.equal(isZohoAnnouncementsFlagOn(null), false);
  assert.equal(isZohoAnnouncementsFlagOn(1), true);
  assert.equal(isZohoAnnouncementsFlagOn(2), false);
});

test("credentials ready requires oauth + both list keys", () => {
  const base: ZohoCampaignsEnv = {
    clientId: "id",
    clientSecret: "secret",
    refreshToken: "refresh",
    creatorsListKey: "creators",
    brandsListKey: "brands",
    fromEmail: "noreply@influo.gr",
    fromName: "Influo",
    topicId: "",
    accountsBase: "https://accounts.zoho.eu",
    apiBase: "https://campaigns.zoho.eu/api/v1.1",
  };
  assert.equal(zohoCampaignsCredentialsReady(base), true);
  assert.equal(zohoCampaignsCredentialsReady({ ...base, refreshToken: "" }), false);
  assert.equal(zohoCampaignsCredentialsReady({ ...base, brandsListKey: "" }), false);
  assert.equal(shouldUseZohoForAnnouncements(1), false); // no process env in tests
  assert.equal(shouldUseZohoForAnnouncements(0), false);
});

test("zoho response ok codes", () => {
  assert.equal(zohoResponseOk({ code: "200", message: "Campaign created successfully" }), true);
  assert.equal(zohoResponseOk({ status: "success", code: "0" }), true);
  assert.equal(zohoResponseOk({ response: { code: "200", campaign_status: "inprogress" } }), true);
  assert.equal(zohoResponseOk({ code: "1001", message: "error" }), false);
});

test("extract campaign key from create response shapes", () => {
  assert.equal(extractZohoCampaignKey({ campaignKey: "10234695", code: "200" }), "10234695");
  assert.equal(
    extractZohoCampaignKey({ response: { campaignkey: "abc", code: "200" } }),
    "abc"
  );
  assert.equal(extractZohoCampaignKey({ code: "200" }), "");
});

test("extract emails from list contacts payload", () => {
  const emails = extractEmailsFromZohoListContacts({
    list_of_details: [
      { contact_email: "A@Example.com" },
      { "Contact Email": "b@example.com" },
      { email: "a@example.com" },
      { contact_email: "" },
    ],
  });
  assert.deepEqual(emails, ["a@example.com", "b@example.com"]);
});

test("announcement html and content urls", () => {
  const html = announcementEmailHtml("/login?redirect=/dashboard", "https://influo.gr");
  assert.match(html, /Υπάρχει μια νέα ανακοίνωση/);
  assert.match(html, /https:\/\/influo\.gr\/login\?redirect=\/dashboard/);
  assert.equal(
    announcementContentUrl("creators", "https://influo.gr/"),
    "https://influo.gr/api/public/zoho-announcement-content?audience=creators"
  );
  assert.match(dashboardPathForAudience("brands"), /brand\/login\?redirect=/);
  assert.match(dashboardPathForAudience("brands"), /announcements/);
});
