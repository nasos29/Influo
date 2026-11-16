import assert from "node:assert/strict";
import test from "node:test";
import { deliverableApprovedToBrand, deliverableReviewToCreator } from "../lib/campaignMail.ts";
import {
  isShowcaseAppearanceNotifyEnabled,
  isShowcaseAppearanceNotifyLive,
} from "../lib/showcaseFlags.ts";
import {
  showcaseBackfillNoticeMail,
  showcaseInlineNoticeHtml,
  showcaseMissingPostHtml,
} from "../lib/showcaseMail.ts";
import { maybeNotifyShowcaseAppearance } from "../lib/showcaseNotify.ts";
import {
  parseShowcaseAddPostToken,
  showcaseAddPostToken,
  showcaseAddPostUrl,
} from "../lib/showcaseAddPost.ts";
import {
  SHOWCASE_HELPER_BRAND_EL,
  SHOWCASE_HELPER_CREATOR_EL,
  showcaseHelperText,
} from "../lib/showcaseCopy.ts";
import {
  consentColumnForParty,
  optedOutColumnForParty,
  parseShowcaseOptOutToken,
  showcaseOptOutToken,
  showcaseOptOutUrl,
} from "../lib/showcaseOptOut.ts";

const UUID = "11111111-2222-4333-8444-555555555555";

test("showcase appearance notify flags are disabled (inline notice instead)", () => {
  assert.equal(isShowcaseAppearanceNotifyEnabled({}), false);
  assert.equal(isShowcaseAppearanceNotifyEnabled({ SHOWCASE_APPEARANCE_NOTIFY_ENABLED: "1" }), false);
  assert.equal(isShowcaseAppearanceNotifyLive({}), false);
  assert.equal(isShowcaseAppearanceNotifyLive({ SHOWCASE_APPEARANCE_NOTIFY_LIVE: "yes" }), true);
});

test("maybeNotifyShowcaseAppearance is a no-op", async () => {
  const result = await maybeNotifyShowcaseAppearance({
    source: "campaign",
    id: UUID,
    brandName: "Acme",
    brandEmail: "a@example.com",
    influencerId: UUID,
    collabLabel: "Reel",
  });
  assert.equal(result.sent, 0);
  assert.equal(result.skipped, "disabled_inline_notice");
});

test("opt-out token round-trip and rejects tampering", () => {
  process.env.SHOWCASE_OPTOUT_SECRET = "test-showcase-secret";
  const token = showcaseOptOutToken("campaign", UUID, "brand");
  const parsed = parseShowcaseOptOutToken(token);
  assert.deepEqual(parsed, { source: "campaign", id: UUID, party: "brand" });

  const bad = token.slice(0, -2) + "aa";
  assert.equal(parseShowcaseOptOutToken(bad), null);
  assert.equal(parseShowcaseOptOutToken(""), null);
  assert.equal(parseShowcaseOptOutToken("not-base64"), null);
});

test("opt-out URL includes token query", () => {
  process.env.SHOWCASE_OPTOUT_SECRET = "test-showcase-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://influo.gr";
  const url = showcaseOptOutUrl("proposal", UUID, "influencer", "en");
  assert.match(url, /^https:\/\/influo\.gr\/showcase\/opt-out\?/);
  assert.match(url, /[?&]t=/);
  assert.match(url, /lang=en/);
});

test("consent / opted-out column helpers", () => {
  assert.equal(consentColumnForParty("brand"), "brand_showcase_consent");
  assert.equal(consentColumnForParty("influencer"), "influencer_showcase_consent");
  assert.equal(optedOutColumnForParty("brand"), "brand_showcase_opted_out");
  assert.equal(optedOutColumnForParty("influencer"), "influencer_showcase_opted_out");
});

test("inline notice has el/en lines and opt-out CTA text", () => {
  process.env.SHOWCASE_OPTOUT_SECRET = "test-showcase-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://influo.gr";
  const url = showcaseOptOutUrl("campaign", UUID, "influencer", "el");
  const html = showcaseInlineNoticeHtml(url);
  assert.match(html, /Πρόσφατες συνεργασίες/);
  assert.match(html, /Recent collaborations/);
  assert.match(html, /Δεν θέλω να εμφανιστεί/);
  assert.match(html, /I don&apos;t want it shown|I don't want it shown/);
  assert.match(html, /\/showcase\/opt-out\?/);
});

test("deliverable approved creator mail includes notice only when opt-out URL passed", () => {
  process.env.SHOWCASE_OPTOUT_SECRET = "test-showcase-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://influo.gr";
  const url = showcaseOptOutUrl("campaign", UUID, "influencer", "el");
  const withNotice = deliverableReviewToCreator({
    influencerName: "Μαρία",
    brandName: "Acme",
    campaignTitle: "Reel",
    status: "approved",
    showcaseOptOutUrl: url,
  });
  assert.match(withNotice.html, /Δεν θέλω να εμφανιστεί/);
  assert.match(withNotice.html, /Πρόσφατες συνεργασίες/);

  const without = deliverableReviewToCreator({
    influencerName: "Μαρία",
    brandName: "Acme",
    campaignTitle: "Reel",
    status: "approved",
  });
  assert.doesNotMatch(without.html, /Δεν θέλω να εμφανιστεί/);

  const changes = deliverableReviewToCreator({
    influencerName: "Μαρία",
    brandName: "Acme",
    campaignTitle: "Reel",
    status: "changes_requested",
    showcaseOptOutUrl: url,
  });
  assert.doesNotMatch(changes.html, /Δεν θέλω να εμφανιστεί/);
});

test("deliverable approved brand mail includes notice only when opt-out URL passed", () => {
  process.env.SHOWCASE_OPTOUT_SECRET = "test-showcase-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://influo.gr";
  const url = showcaseOptOutUrl("campaign", UUID, "brand", "el");
  const withNotice = deliverableApprovedToBrand({
    brandEmail: "b@example.com",
    brandName: "Acme",
    campaignTitle: "Reel",
    influencerName: "Μαρία",
    showcaseOptOutUrl: url,
  });
  assert.match(withNotice.html, /Δεν θέλω να εμφανιστεί/);
  assert.match(withNotice.subject, /Εγκρίθηκε η παράδοση/);

  const without = deliverableApprovedToBrand({
    brandEmail: "b@example.com",
    brandName: "Acme",
    campaignTitle: "Reel",
    influencerName: "Μαρία",
  });
  assert.doesNotMatch(without.html, /Δεν θέλω να εμφανιστεί/);
});

test("backfill notice mail mentions 7-day window", () => {
  process.env.SHOWCASE_OPTOUT_SECRET = "test-showcase-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://influo.gr";
  const mail = showcaseBackfillNoticeMail({
    party: "influencer",
    recipientName: "Maria",
    otherPartyName: "Acme",
    collabLabel: "Story",
    source: "proposal",
    id: UUID,
    deadlineLabel: "23 Νοεμβρίου 2026",
  });
  assert.match(mail.subject, /7 ημέρες/);
  assert.match(mail.html, /23 Νοεμβρίου 2026/);
  assert.match(mail.html, /Δεν θέλω δημόσια προβολή/);
  assert.match(mail.html, /Οι συνεργασίες σου εμφανίζονται στην αρχική/);
});

test("add-post token round-trip and rejects tampering", () => {
  process.env.SHOWCASE_OPTOUT_SECRET = "test-showcase-secret";
  const token = showcaseAddPostToken("proposal", UUID);
  assert.deepEqual(parseShowcaseAddPostToken(token), {
    source: "proposal",
    id: UUID,
    party: "influencer",
  });
  assert.equal(parseShowcaseAddPostToken(token.slice(0, -2) + "aa"), null);
  assert.equal(parseShowcaseOptOutToken(token), null);
});

test("add-post URL and missing-post email CTA", () => {
  process.env.SHOWCASE_OPTOUT_SECRET = "test-showcase-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://influo.gr";
  const url = showcaseAddPostUrl("campaign", UUID, "el");
  assert.match(url, /^https:\/\/influo\.gr\/showcase\/add-post\?/);
  const html = showcaseMissingPostHtml(url);
  assert.match(html, /Πρόσθεσε το link της ανάρτησης/);
  assert.match(html, /\/showcase\/add-post\?/);
  assert.match(html, /Οι συνεργασίες σου εμφανίζονται στην αρχική/);
});

test("backfill mail includes add-post CTA when missingPostUrl", () => {
  process.env.SHOWCASE_OPTOUT_SECRET = "test-showcase-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://influo.gr";
  const withCta = showcaseBackfillNoticeMail({
    party: "influencer",
    recipientName: "Maria",
    otherPartyName: "Acme",
    collabLabel: "Story",
    source: "proposal",
    id: UUID,
    deadlineLabel: "23 Νοεμβρίου 2026",
    missingPostUrl: true,
  });
  assert.match(withCta.html, /Πρόσθεσε το link της ανάρτησης/);
  assert.match(withCta.html, /\/showcase\/add-post\?/);

  const brand = showcaseBackfillNoticeMail({
    party: "brand",
    recipientName: "Acme",
    otherPartyName: "Maria",
    collabLabel: "Story",
    source: "proposal",
    id: UUID,
    deadlineLabel: "23 Νοεμβρίου 2026",
    missingPostUrl: true,
  });
  assert.doesNotMatch(brand.html, /Πρόσθεσε το link της ανάρτησης/);
  assert.match(brand.html, /Η καμπάνια σας προβάλλεται/);
});

test("showcase helper copy is party-specific", () => {
  assert.equal(showcaseHelperText("influencer", "el"), SHOWCASE_HELPER_CREATOR_EL);
  assert.equal(showcaseHelperText("brand", "el"), SHOWCASE_HELPER_BRAND_EL);
});
