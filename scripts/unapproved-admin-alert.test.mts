import assert from "node:assert/strict";
import test from "node:test";
import {
  unapprovedAdminAlertAlreadyToday,
  unapprovedAdminAlertDedupeKey,
} from "../lib/unapprovedAdminAlertDedupe.ts";

test("dedupe key is influencer id and reason", () => {
  assert.equal(unapprovedAdminAlertDedupeKey("abc", "reason one"), "abc|reason one");
});

test("same Athens calendar day counts as already alerted", () => {
  const now = new Date("2026-11-23T20:00:00.000Z");
  assert.equal(
    unapprovedAdminAlertAlreadyToday([{ created_at: "2026-11-23T08:00:00.000Z" }], now),
    true
  );
});

test("prior alert on previous Athens day does not block", () => {
  const now = new Date("2026-11-23T20:00:00.000Z");
  assert.equal(
    unapprovedAdminAlertAlreadyToday([{ created_at: "2026-11-22T10:00:00.000Z" }], now),
    false
  );
});