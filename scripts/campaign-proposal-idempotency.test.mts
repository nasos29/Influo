// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/campaign-proposal-idempotency.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  isCampaignServiceType,
  shouldBlockDuplicateCampaignProposal,
} from "../lib/campaignProposalIdempotency.ts";

test("campaign service labels are detected in el and en", () => {
  assert.equal(isCampaignServiceType("Καμπάνια: Εστιατόριο Άθος"), true);
  assert.equal(isCampaignServiceType("Campaign: Restaurant Athos"), true);
  assert.equal(isCampaignServiceType("Instagram Reel"), false);
  assert.equal(isCampaignServiceType(""), false);
});

test("duplicate active campaign proposals are blocked only for campaign labels", () => {
  assert.equal(shouldBlockDuplicateCampaignProposal("Καμπάνια: X", 1), true);
  assert.equal(shouldBlockDuplicateCampaignProposal("Καμπάνια: X", 0), false);
  assert.equal(shouldBlockDuplicateCampaignProposal("Instagram Post", 5), false);
});
