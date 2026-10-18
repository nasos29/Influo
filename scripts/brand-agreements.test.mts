import assert from "node:assert/strict";
import test from "node:test";
import { openAgreementCount, openBrandAgreements } from "../lib/brandAgreements.ts";

test("an accepted application with neither signature is an open agreement", () => {
  const queue = openBrandAgreements([
    { id: 53, status: "accepted", influencer_agreement_accepted: false, brand_agreement_accepted: false },
    { id: 1, status: "pending", influencer_agreement_accepted: false, brand_agreement_accepted: false },
  ]);
  assert.deepEqual(queue.awaitingInfluencer.map((row) => row.id), [53]);
  assert.equal(queue.needsBrand.length, 0);
  assert.equal(openAgreementCount(queue.awaitingInfluencer.concat(queue.needsBrand)), 1);
});

test("the brand's turn is counted separately from a finished agreement", () => {
  const queue = openBrandAgreements([
    { id: 2, status: "accepted", influencer_agreement_accepted: true, brand_agreement_accepted: false },
    { id: 3, status: "completed", influencer_agreement_accepted: true, brand_agreement_accepted: true },
  ]);
  assert.deepEqual(queue.needsBrand.map((row) => row.id), [2]);
  assert.equal(queue.awaitingInfluencer.length, 0);
});
