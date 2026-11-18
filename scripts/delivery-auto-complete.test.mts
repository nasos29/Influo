import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isCampaignLinkAutoCompleteDeliverable,
  isProposalLinkAutoCompleteDeliverable,
} from "../lib/deliveryCompletion.ts";

test("campaign link auto-complete only for submitted deliverables", () => {
  assert.equal(isCampaignLinkAutoCompleteDeliverable("submitted"), true);
  assert.equal(isCampaignLinkAutoCompleteDeliverable("changes_requested"), false);
  assert.equal(isCampaignLinkAutoCompleteDeliverable("approved"), false);
  assert.equal(isCampaignLinkAutoCompleteDeliverable(null), false);
});

test("proposal link auto-complete skips changes_requested", () => {
  assert.equal(isProposalLinkAutoCompleteDeliverable(null), true);
  assert.equal(isProposalLinkAutoCompleteDeliverable("submitted"), true);
  assert.equal(isProposalLinkAutoCompleteDeliverable("changes_requested"), false);
  assert.equal(isProposalLinkAutoCompleteDeliverable("approved"), false);
});