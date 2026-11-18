import assert from "node:assert/strict";
import { test } from "node:test";
import { canCancelDeal, validateCancelReason } from "../lib/dealCancelEligibility.ts";

test("validateCancelReason length", () => {
  assert.equal(validateCancelReason("short").ok, false);
  const ok = validateCancelReason("  Valid reason here  ");
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.reason, "Valid reason here");
});

test("canCancelDeal eligibility", () => {
  assert.equal(canCancelDeal({ status: "pending" }), false);
  assert.equal(canCancelDeal({ status: "rejected" }), false);
  assert.equal(canCancelDeal({ status: "cancelled" }), false);
  assert.equal(
    canCancelDeal({ status: "completed", delivery_confirmed_at: "2026-01-01T00:00:00Z" }),
    false
  );
  assert.equal(canCancelDeal({ status: "accepted" }), true);
  assert.equal(canCancelDeal({ status: "completed" }), true);
});