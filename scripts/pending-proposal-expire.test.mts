import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isPendingProposalExpireEnabled,
  PENDING_EXPIRED_CANCEL_REASON,
  pendingProposalExpireDays,
} from "../lib/deliveryFlags.ts";

test("pending proposal expire flag defaults off", () => {
  assert.equal(isPendingProposalExpireEnabled({}), false);
  assert.equal(isPendingProposalExpireEnabled({ PENDING_PROPOSAL_EXPIRE_ENABLED: "0" }), false);
  assert.equal(isPendingProposalExpireEnabled({ PENDING_PROPOSAL_EXPIRE_ENABLED: "true" }), true);
});

test("pending proposal expire days defaults to 14", () => {
  assert.equal(pendingProposalExpireDays({}), 14);
  assert.equal(pendingProposalExpireDays({ PENDING_PROPOSAL_EXPIRE_DAYS: "30" }), 30);
  assert.equal(pendingProposalExpireDays({ PENDING_PROPOSAL_EXPIRE_DAYS: "nope" }), 14);
});

test("expire uses stable cancel_reason token (in-app only; no email flag)", () => {
  assert.equal(PENDING_EXPIRED_CANCEL_REASON, "pending_expired");
  assert.equal(isPendingProposalExpireEnabled({ DEAL_CANCEL_EMAILS_ENABLED: "true" }), false);
});