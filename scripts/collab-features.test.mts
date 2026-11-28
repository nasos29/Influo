import assert from "node:assert/strict";
import { test } from "node:test";
import { COLLAB_DELIVERABLE_UPLOAD_PURPOSE } from "../lib/collabDeliverableUpload.ts";
import { canRequestDraftChanges, MAX_UGC_DRAFT_REVISION_ROUNDS } from "../lib/deliverableRevisionLimits.ts";
import { extrasFromRateCard, RATE_CARD_EXTRA_KEYS } from "../lib/servicePackages.ts";
import { canConfirmReceipt, canMarkShipped, shippingNeedsProduct } from "../lib/shippingState.ts";
import { creatorMeetsCampaignRequirements } from "../lib/campaignCreatorMatch.ts";
import { campaignRequiresUgcDraft, proposalRequiresUgcDraft } from "../lib/collaborationUgc.ts";
import { collabTrackingSavePayload } from "../lib/collabTrackingSave.ts";
import { parseDirectoryFilters, directoryEngagement } from "../lib/directoryQuery.ts";
import { apiBodyString } from "../lib/apiBodyString.ts";

test("collab_deliverable purpose is distinct from portfolio", () => {
  assert.equal(COLLAB_DELIVERABLE_UPLOAD_PURPOSE, "collab_deliverable");
});

test("UGC draft revision limit is 2", () => {
  assert.equal(MAX_UGC_DRAFT_REVISION_ROUNDS, 2);
  assert.equal(canRequestDraftChanges(true, 0, "submitted"), true);
  assert.equal(canRequestDraftChanges(true, 1, "submitted"), true);
  assert.equal(canRequestDraftChanges(true, MAX_UGC_DRAFT_REVISION_ROUNDS, "submitted"), false);
  assert.equal(canRequestDraftChanges(false, 1, "submitted"), false);
});

test("collab tracking save payload by role", () => {
  assert.deepEqual(collabTrackingSavePayload(true, { promo: "P", utm: "U", spark: "S" }), {
    promoCode: "P",
    utmLink: "U",
  });
  assert.deepEqual(collabTrackingSavePayload(false, { promo: "P", utm: "U", spark: "S" }), {
    sparkAdsCode: "S",
  });
});

test("apiBodyString rejects non-strings", () => {
  assert.equal(apiBodyString("ok"), "ok");
  assert.equal(apiBodyString({ id: 1 }), "");
});

test("extras keys keep 30d backward compatible and add 90d/perpetual", () => {
  assert.ok(RATE_CARD_EXTRA_KEYS.includes("usage_rights_ads"));
  assert.ok(RATE_CARD_EXTRA_KEYS.includes("usage_rights_ads_90d"));
  assert.ok(RATE_CARD_EXTRA_KEYS.includes("usage_rights_ads_perpetual"));
  const extras = extrasFromRateCard({ usage_rights_ads: "15", usage_rights_ads_90d: "40" });
  assert.equal(extras.usage_rights_ads, "15");
  assert.equal(extras.usage_rights_ads_90d, "40");
});

test("shipping state machine", () => {
  assert.equal(shippingNeedsProduct("money"), false);
  assert.equal(shippingNeedsProduct("product"), true);
  assert.equal(canMarkShipped({ status: "address_submitted" }), true);
  assert.equal(canConfirmReceipt({ status: "shipped" }), true);
});

test("directory ER range filter parsing", () => {
  const f = parseDirectoryFilters(new URLSearchParams("engagement=3&maxEngagement=10"));
  assert.equal(f.engagement, "3");
  assert.equal(f.maxEngagement, "10");
  assert.equal(directoryEngagement("5"), 5);
});

test("campaign gender and ER requirements", () => {
  const badGender = creatorMeetsCampaignRequirements(
    { required_gender: "Female" },
    { gender: "Male", accounts: {}, engagement_rate: "4" }
  );
  assert.equal(badGender.ok, false);
  const badEr = creatorMeetsCampaignRequirements(
    { min_engagement_rate: 5, max_engagement_rate: 8 },
    { gender: "Female", accounts: {}, engagement_rate: "3" }
  );
  assert.equal(badEr.ok, false);
  assert.equal(badEr.reason, "engagement_min");
});

test("UGC detection", () => {
  assert.equal(proposalRequiresUgcDraft({ service_type: "UGC video 30s" }), true);
  assert.equal(campaignRequiresUgcDraft({ deliverables: "2x ugc_photo" }), true);
  assert.equal(campaignRequiresUgcDraft({ deliverables: "1 reel" }), false);
});