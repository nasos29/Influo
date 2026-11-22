import assert from "node:assert/strict";
import test from "node:test";
import {
  collectPermanentMissingHandles,
  shouldSetWrongUsernameHold,
} from "../lib/wrongUsernameHold.ts";
import {
  isClearAccountNotFoundForEmail,
  isPermanentAccountMissingError,
  isWrongUsernameHoldError,
} from "../lib/socialAccountMissing.ts";

test("email: clear not-found only", () => {
  assert.equal(isClearAccountNotFoundForEmail("Profile @foo not found."), true);
  assert.equal(isClearAccountNotFoundForEmail("Λάθος username: το προφίλ @foo δεν υπάρχει."), true);
  assert.equal(isClearAccountNotFoundForEmail("Private profile: το προφίλ @foo είναι ιδιωτικό."), false);
  assert.equal(isClearAccountNotFoundForEmail("πιθανό λάθος username (0/0/0)"), false);
});

test("hold includes private and zero-stats", () => {
  assert.equal(isWrongUsernameHoldError("Private profile: το προφίλ @foo είναι ιδιωτικό."), true);
  assert.equal(isWrongUsernameHoldError("πιθανό λάθος username"), true);
  assert.equal(isWrongUsernameHoldError("Auditpr request failed: timeout"), false);
  const zero = [
    { platform: "instagram", username: "foo", ok: true, followers: "0", avg_likes: "0", posts_count: 0 },
  ];
  assert.equal(shouldSetWrongUsernameHold(zero), true);
  assert.deepEqual(collectPermanentMissingHandles(zero), [{ platform: "instagram", handle: "foo" }]);
});

test("permanent missing helper unchanged for legacy callers", () => {
  assert.equal(isPermanentAccountMissingError("Λάθος username: το προφίλ @foo δεν υπάρχει."), true);
  assert.equal(isPermanentAccountMissingError("Private profile: ιδιωτικό"), false);
});