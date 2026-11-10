import assert from "node:assert/strict";
import test from "node:test";
import {
  extractEmailsFromZohoListContacts,
  extractZohoCampaignDetails,
  extractZohoCampaignKey,
  extractZohoEmailList,
  extractZohoListKey,
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
import { SITE_SETTING_META } from "../lib/siteSettings.ts";

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

test("extract campaign details status and emails_sent_count", () => {
  const details = extractZohoCampaignDetails({
    campaign_status: "Sent",
    "campaign-reports": [{ emails_sent_count: "1" }],
    code: "0",
  });
  assert.equal(details.status, "Sent");
  assert.equal(details.emailsSentCount, 1);
  assert.equal(
    extractZohoCampaignDetails({ response: { campaign_status: "InProgress" } }).emailsSentCount,
    null
  );
});

test("extract list key from addlistandcontacts response shapes", () => {
  assert.equal(
    extractZohoListKey({
      status: "success",
      listkey: "f70c4878c4a471691e3931dd52bedc79",
      code: "0",
    }),
    "f70c4878c4a471691e3931dd52bedc79"
  );
  assert.equal(
    extractZohoListKey({ response: { listKey: "nested-key", code: "0" } }),
    "nested-key"
  );
  assert.equal(extractZohoListKey({ code: "0" }), "");
});

test("extract ignored contacts from addlistandcontacts payload", () => {
  assert.deepEqual(
    extractZohoEmailList(
      {
        ignored_contacts: ["Support@Influo.gr", "a@example.com"],
        code: "0",
      },
      "ignored_contacts"
    ),
    ["support@influo.gr", "a@example.com"]
  );
});

test("admin settings description covers selected recipients + Resend fallback", () => {
  const desc = SITE_SETTING_META.zoho_campaigns_announcements.description;
  assert.match(desc.el, /επιλεγμέν/i);
  assert.match(desc.el, /Resend/i);
  assert.match(desc.el, /προσωριν/i);
  assert.match(desc.en, /selected/i);
  assert.match(desc.en, /temp/i);
  assert.match(desc.en, /Resend/i);
});

test("topic details payload exposes topicId for resolveZohoTopicId fallback", () => {
  const payload = {
    topicDetails: [{ topicId: "301088000000031009", topicName: "Marketing" }],
    code: "200",
  };
  assert.equal(
    extractZohoEmailList(payload, "ignored_contacts").length,
    0
  );
  assert.equal(String(payload.topicDetails[0].topicId), "301088000000031009");
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
