import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isCampaignEligibleForReview,
  isProposalAgreementLocked,
  isProposalEligibleForReview,
} from "../lib/reviewEligibility.ts";

test("proposal agreement-only without delivery is ineligible", () => {
  const row = {
    status: "completed",
    influencer_agreement_accepted: true,
    brand_agreement_accepted: true,
    delivery_confirmed_at: null,
    auto_completed_at: null,
  };
  assert.equal(isProposalAgreementLocked(row), true);
  assert.equal(isProposalEligibleForReview(row), false);
});

test("proposal real completion is eligible", () => {
  assert.equal(
    isProposalEligibleForReview({
      status: "completed",
      influencer_agreement_accepted: true,
      brand_agreement_accepted: true,
      delivery_confirmed_at: "2026-11-01T00:00:00.000Z",
    }),
    true
  );
  assert.equal(
    isProposalEligibleForReview({
      status: "accepted",
      influencer_agreement_accepted: true,
      brand_agreement_accepted: true,
      auto_completed_at: "2026-11-01T00:00:00.000Z",
    }),
    true
  );
});

test("campaign approved or confirmed is eligible", () => {
  assert.equal(
    isCampaignEligibleForReview({
      status: "accepted",
      deliverable_status: "approved",
    }),
    true
  );
  assert.equal(
    isCampaignEligibleForReview({
      status: "accepted",
      delivery_confirmed_at: "2026-11-01T00:00:00.000Z",
    }),
    true
  );
});

test("campaign without real completion is ineligible", () => {
  assert.equal(
    isCampaignEligibleForReview({
      status: "accepted",
      deliverable_status: "submitted",
    }),
    false
  );
  assert.equal(isCampaignEligibleForReview({ status: "pending", deliverable_status: "approved" }), false);
});