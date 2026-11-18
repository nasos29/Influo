import assert from "node:assert/strict";
import { test } from "node:test";
import { isCampaignLinkAutoCompleteDeliverable } from "../lib/deliveryCompletion.ts";

test("campaign link auto-complete only for submitted deliverables", () => {
  assert.equal(isCampaignLinkAutoCompleteDeliverable("submitted"), true);
  assert.equal(isCampaignLinkAutoCompleteDeliverable("changes_requested"), false);
  assert.equal(isCampaignLinkAutoCompleteDeliverable("approved"), false);
  assert.equal(isCampaignLinkAutoCompleteDeliverable(null), false);
});