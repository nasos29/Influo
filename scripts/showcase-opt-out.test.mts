import assert from "node:assert/strict";
import test from "node:test";
import {
  isShowcaseAppearanceNotifyEnabled,
  isShowcaseAppearanceNotifyLive,
} from "../lib/showcaseFlags.ts";
import {
  showcaseAppearanceNotifyMail,
  showcaseBackfillNoticeMail,
} from "../lib/showcaseMail.ts";
import {
  consentColumnForParty,
  optedOutColumnForParty,
  parseShowcaseOptOutToken,
  showcaseOptOutToken,
  showcaseOptOutUrl,
} from "../lib/showcaseOptOut.ts";

const UUID = "11111111-2222-4333-8444-555555555555";

test("showcase appearance notify flags default OFF", () => {
  assert.equal(isShowcaseAppearanceNotifyEnabled({}), false);
  assert.equal(isShowcaseAppearanceNotifyLive({}), false);
  assert.equal(isShowcaseAppearanceNotifyEnabled({ SHOWCASE_APPEARANCE_NOTIFY_ENABLED: "1" }), true);
  assert.equal(isShowcaseAppearanceNotifyLive({ SHOWCASE_APPEARANCE_NOTIFY_LIVE: "yes" }), true);
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

test("appearance notify mail is Greek and has opt-out CTA", () => {
  process.env.SHOWCASE_OPTOUT_SECRET = "test-showcase-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://influo.gr";
  const mail = showcaseAppearanceNotifyMail({
    party: "brand",
    recipientName: "Acme",
    otherPartyName: "Maria",
    collabLabel: "Reel",
    source: "campaign",
    id: UUID,
  });
  assert.match(mail.subject, /Πρόσφατες συνεργασίες/);
  assert.match(mail.html, /Εξαίρεση από τις Πρόσφατες συνεργασίες/);
  assert.match(mail.html, /\/showcase\/opt-out\?/);
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
});
