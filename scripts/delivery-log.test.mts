// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/delivery-log.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { activityInThread, emailLogLine, pushLogLine } from "../lib/deliveryLog.ts";
import { PRESENCE_STALE_MS } from "../lib/presenceStatus.ts";

test("email log names the type and the result only", () => {
  assert.equal(emailLogLine("proposal_new", true), "email sent type=proposal_new ok=true");
  assert.equal(emailLogLine("proposal_rejected", false), "email sent type=proposal_rejected ok=false");
});

test("push log reports how many devices were reached", () => {
  assert.equal(pushLogLine("counter_new", 2), "push sent type=counter_new count=2");
  assert.equal(pushLogLine("message", 0, true), "push sent type=message count=0 skipped=online");
});

test("a fresh thread activity stamp means the recipient is in that thread", () => {
  const now = Date.parse("2026-10-11T10:00:00.000Z");
  assert.equal(activityInThread(new Date(now - 10_000).toISOString(), now), true);
  assert.equal(activityInThread(new Date(now - PRESENCE_STALE_MS).toISOString(), now), false);
  assert.equal(activityInThread(null, now), false);
  assert.equal(activityInThread("not-a-date", now), false);
});
