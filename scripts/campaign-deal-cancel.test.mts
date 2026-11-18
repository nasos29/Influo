import assert from "node:assert/strict";
import { test } from "node:test";
import { isCollabEmailExcludedInfluencer, PALLI_INFLUENCER_ID } from "../lib/collabEmailExclusion.ts";
import {
  campaignRealCompletionAt,
  isCampaignRealDeliveryComplete,
} from "../lib/campaignDealCompletion.ts";
import { canCancelCampaignDeal, validateCancelReason } from "../lib/campaignDealCancelEligibility.ts";
import {
  isBrandApproveRemindersEnabled,
  isCampaignDealCancelEmailsEnabled,
  isDeliverableRemindersEnabled,
} from "../lib/deliveryFlags.ts";
import {
  shouldSendCampaignReviewReminder,
  shouldSendCampaignSecondReviewReminder,
} from "../lib/campaignReviewReminder.ts";

test("campaign cancel eligibility", () => {
  assert.equal(canCancelCampaignDeal({ status: "pending" }), false);
  assert.equal(canCancelCampaignDeal({ status: "accepted" }), true);
  assert.equal(canCancelCampaignDeal({ status: "cancelled" }), false);
  assert.equal(
    canCancelCampaignDeal({ status: "accepted", delivery_confirmed_at: "2026-01-01T00:00:00Z" }),
    false
  );
  assert.equal(
    canCancelCampaignDeal({ status: "accepted", deliverable_status: "approved" }),
    false
  );
});

test("validateCancelReason reused for campaigns", () => {
  assert.equal(validateCancelReason("short").ok, false);
  const ok = validateCancelReason("Valid campaign reason");
  assert.equal(ok.ok, true);
});

test("campaign real completion", () => {
  assert.equal(isCampaignRealDeliveryComplete({}), false);
  assert.equal(isCampaignRealDeliveryComplete({ deliverable_status: "approved" }), true);
  assert.equal(
    campaignRealCompletionAt({ deliverable_status: "approved", reviewed_at: "2026-02-01T00:00:00Z" }),
    "2026-02-01T00:00:00Z"
  );
});

test("campaign review reminder gates", () => {
  const now = new Date("2026-03-10T12:00:00Z").getTime();
  assert.equal(
    shouldSendCampaignReviewReminder({
      status: "cancelled",
      realCompletedAt: "2026-03-01T00:00:00Z",
      nowMs: now,
    }),
    false
  );
  assert.equal(
    shouldSendCampaignReviewReminder({
      status: "accepted",
      realCompletedAt: null,
      nowMs: now,
    }),
    false
  );
  assert.equal(
    shouldSendCampaignReviewReminder({
      status: "accepted",
      realCompletedAt: "2025-12-01T00:00:00Z",
      nowMs: now,
      fromRealCompletion: true,
    }),
    false
  );
  assert.equal(
    shouldSendCampaignSecondReviewReminder({
      status: "accepted",
      reviewReminderSentAt: "2026-03-01T00:00:00Z",
      reviewReminderSecondSentAt: null,
      nowMs: now,
    }),
    true
  );
});

test("reminder and cancel email flags default OFF", () => {
  const prev = { ...process.env };
  delete process.env.DELIVERABLE_REMINDERS_ENABLED;
  delete process.env.BRAND_APPROVE_REMINDERS_ENABLED;
  delete process.env.DEAL_CANCEL_EMAILS_ENABLED;
  delete process.env.CAMPAIGN_DEAL_CANCEL_EMAILS_ENABLED;
  assert.equal(isDeliverableRemindersEnabled(), false);
  assert.equal(isBrandApproveRemindersEnabled(), false);
  assert.equal(isCampaignDealCancelEmailsEnabled(), false);
  Object.assign(process.env, prev);
});

test("Maria Palli excluded from campaign reminder sends", () => {
  assert.equal(isCollabEmailExcludedInfluencer(PALLI_INFLUENCER_ID), true);
});