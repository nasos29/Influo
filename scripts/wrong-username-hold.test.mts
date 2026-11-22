import assert from "node:assert/strict";
import test from "node:test";
import {
  collectPermanentMissingHandles,
  currentHandlesFromAccounts,
  handlesMatchSnapshot,
  handlesSnapshotFromScrapeAccounts,
  shouldSetWrongUsernameHold,
  shouldSkipWrongUsernameHeldCreator,
} from "../lib/wrongUsernameHold.ts";

const heldAt = "2026-11-20T10:00:00.000Z";
const snapshot = [{ platform: "instagram", handle: "foo" }];
const accounts = [{ platform: "instagram", username: "@foo" }];

test("held + same handles + no profile change => skip", () => {
  assert.equal(
    shouldSkipWrongUsernameHeldCreator({
      wrong_username_held_at: heldAt,
      wrong_username_handles: snapshot,
      accounts,
      profileChangeTimestamps: [],
    }),
    true
  );
});

test("no hold => do not skip", () => {
  assert.equal(
    shouldSkipWrongUsernameHeldCreator({
      wrong_username_held_at: null,
      wrong_username_handles: null,
      accounts,
      profileChangeTimestamps: [],
    }),
    false
  );
});

test("profile change after hold => audit again", () => {
  assert.equal(
    shouldSkipWrongUsernameHeldCreator({
      wrong_username_held_at: heldAt,
      wrong_username_handles: snapshot,
      accounts,
      profileChangeTimestamps: ["2026-11-21T12:00:00.000Z"],
    }),
    false
  );
});

test("handle change => audit again", () => {
  assert.equal(
    shouldSkipWrongUsernameHeldCreator({
      wrong_username_held_at: heldAt,
      wrong_username_handles: snapshot,
      accounts: [{ platform: "instagram", username: "bar" }],
      profileChangeTimestamps: [],
    }),
    false
  );
});

test("transient scrape errors do not create a hold", () => {
  const mixed = [
    { platform: "instagram", username: "foo", ok: false, error: "Could not read Instagram profile in browser." },
    { platform: "tiktok", username: "bar", ok: false, error: "Auditpr request failed: timeout" },
  ];
  assert.equal(shouldSetWrongUsernameHold(mixed), false);
  assert.deepEqual(collectPermanentMissingHandles(mixed), []);
});

test("permanent missing among failures still sets hold", () => {
  const mixed = [
    { platform: "instagram", username: "foo", ok: false, error: "Profile @foo not found." },
    { platform: "tiktok", username: "bar", ok: false, error: "session died" },
  ];
  assert.equal(shouldSetWrongUsernameHold(mixed), true);
  assert.deepEqual(collectPermanentMissingHandles(mixed), [{ platform: "instagram", handle: "foo" }]);
});

test("handle snapshot compares normalized handles", () => {
  const current = currentHandlesFromAccounts([{ platform: "Instagram", username: "@Foo" }]);
  assert.equal(handlesMatchSnapshot(current, snapshot), true);
});

test("hold snapshot stores all scraped accounts not only permanent-missing failures", () => {
  const mixed = [
    { platform: "instagram", username: "foo", ok: false, error: "Profile @foo not found." },
    { platform: "tiktok", username: "@bar", ok: true },
  ];
  assert.deepEqual(handlesSnapshotFromScrapeAccounts(mixed), [
    { platform: "instagram", handle: "foo" },
    { platform: "tiktok", handle: "bar" },
  ]);
});

test("held + permanent fail among other accounts + same DB handles => skip", () => {
  const fullSnapshot = [
    { platform: "instagram", handle: "foo" },
    { platform: "tiktok", handle: "bar" },
  ];
  assert.equal(
    shouldSkipWrongUsernameHeldCreator({
      wrong_username_held_at: heldAt,
      wrong_username_handles: fullSnapshot,
      accounts: [
        { platform: "instagram", username: "foo" },
        { platform: "tiktok", username: "bar" },
      ],
      profileChangeTimestamps: [],
    }),
    true
  );
});