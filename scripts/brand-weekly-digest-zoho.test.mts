import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDigestHtml,
  digestSubject,
  getWeeklyDigestWindow,
  isBrandWeeklyDigestZohoEnabled,
  isBrandWeeklyDigestZohoLive,
  brandWeeklyDigestTestRecipient,
  isWithinQuietSendWindow,
} from "../lib/brandWeeklyInfluencerDigest.ts";
import {
  BRAND_WEEKLY_DIGEST_SUBJECT,
  brandWeeklyDigestContentUrl,
  brandWeeklyDigestEmailHtml,
} from "../lib/zohoBrandWeeklyDigestContent.ts";

const sampleInfluencers = [
  {
    id: "1",
    display_name: "Test Creator",
    category: "Lifestyle",
    accounts: [{ platform: "instagram", followers: "12.5k" }],
    approved_at: "2026-11-10T10:00:00.000Z",
    profile_slug: "test-creator",
    avatar_url: null,
  },
];

test("Zoho digest flags default OFF", () => {
  assert.equal(isBrandWeeklyDigestZohoEnabled({}), false);
  assert.equal(isBrandWeeklyDigestZohoLive({}), false);
  assert.equal(isBrandWeeklyDigestZohoEnabled({ BRAND_WEEKLY_DIGEST_ZOHO_ENABLED: "1" }), true);
  assert.equal(isBrandWeeklyDigestZohoLive({ BRAND_WEEKLY_DIGEST_ZOHO_LIVE: "yes" }), true);
  assert.equal(
    brandWeeklyDigestTestRecipient({
      BRAND_WEEKLY_DIGEST_TEST_RECIPIENT: "nd.6@hotmail.com",
    }),
    "nd.6@hotmail.com"
  );
});

test("digest subject + Zoho content URL stable", () => {
  assert.equal(digestSubject(1), "Νέος influencer αυτή την εβδομάδα – Influo");
  assert.match(digestSubject(3), /^3 νέοι influencers/);
  assert.equal(BRAND_WEEKLY_DIGEST_SUBJECT(2), digestSubject(2));
  const window = {
    start: "2026-11-08T00:00:00.000Z",
    end: "2026-11-15T00:00:00.000Z",
  };
  assert.equal(
    brandWeeklyDigestContentUrl(window, "https://influo.gr"),
    "https://influo.gr/api/public/zoho-brand-weekly-digest-content?start=2026-11-08T00%3A00%3A00.000Z&end=2026-11-15T00%3A00%3A00.000Z"
  );
});

test("Zoho bulk HTML is generic Greek and keeps digest content", () => {
  const window = getWeeklyDigestWindow(new Date("2026-11-15T12:00:00.000Z"));
  const html = brandWeeklyDigestEmailHtml(sampleInfluencers as any, window);
  assert.match(html, /Γεια σας,/);
  assert.doesNotMatch(html, /Γεια σας Επιχείρηση/);
  assert.match(html, /Test Creator/);
  assert.match(html, /Κατηγορία: Lifestyle/);
  assert.match(html, /directory/);
  assert.match(html, /unsubscribe/i);
  assert.match(html, /Καμπάνια/);

  const personalized = buildDigestHtml("Acme", sampleInfluencers as any, window);
  assert.match(personalized, /Γεια σας Acme/);
});

test("quiet window helper: Athens 10–19", () => {
  // 2026-11-15 12:00 UTC ≈ 14:00 Athens (EET) → inside
  assert.equal(isWithinQuietSendWindow(Date.parse("2026-11-15T12:00:00.000Z")), true);
  // 06:00 UTC ≈ 08:00 Athens → outside
  assert.equal(isWithinQuietSendWindow(Date.parse("2026-11-15T06:00:00.000Z")), false);
});
