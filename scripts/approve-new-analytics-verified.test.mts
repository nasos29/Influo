import assert from "node:assert/strict";
import test from "node:test";
import { buildNewInfluencerApprovalPatch } from "../lib/approveNewApprovalPatch.ts";

test("analytics_verified false when insights check did not pass", () => {
  const patch = buildNewInfluencerApprovalPatch(false, "2026-01-01T00:00:00.000Z");
  assert.equal(patch.analytics_verified, false);
  assert.equal(patch.approved, true);
  assert.ok(!("analytics_verified_at" in patch));
});

test("analytics_verified true only when insights check passed", () => {
  const patch = buildNewInfluencerApprovalPatch(true, "2026-01-01T00:00:00.000Z");
  assert.equal(patch.analytics_verified, true);
  assert.equal(patch.analytics_verified_at, "2026-01-01T00:00:00.000Z");
});