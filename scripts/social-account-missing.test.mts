import test from "node:test";
import assert from "node:assert/strict";
import { isPermanentAccountMissingError } from "../lib/socialAccountMissing.ts";

test("permanent missing vs transient/session", () => {
  assert.equal(isPermanentAccountMissingError("Λάθος username: το προφίλ @foo δεν υπάρχει."), true);
  assert.equal(isPermanentAccountMissingError("Private profile: το προφίλ @foo είναι ιδιωτικό."), false);
  assert.equal(isPermanentAccountMissingError("no instagram session"), false);
  assert.equal(isPermanentAccountMissingError("Auditpr request failed: timeout"), false);
  assert.equal(isPermanentAccountMissingError("User not found on TikTok"), true);
});