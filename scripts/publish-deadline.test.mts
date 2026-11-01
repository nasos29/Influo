import assert from "node:assert/strict";
import test from "node:test";
import { parsePublishDeadline } from "../lib/publishDeadline.ts";

test("parsePublishDeadline keeps an empty value empty", () => {
  assert.deepEqual(parsePublishDeadline(undefined), { ok: true, date: null });
  assert.deepEqual(parsePublishDeadline(null), { ok: true, date: null });
  assert.deepEqual(parsePublishDeadline("  "), { ok: true, date: null });
});

test("parsePublishDeadline accepts a real calendar date", () => {
  assert.deepEqual(parsePublishDeadline("2026-11-01"), { ok: true, date: "2026-11-01" });
});

test("parsePublishDeadline rejects dates that are not a calendar day", () => {
  assert.deepEqual(parsePublishDeadline("2026-02-31"), { ok: false });
  assert.deepEqual(parsePublishDeadline("01/11/2026"), { ok: false });
  assert.deepEqual(parsePublishDeadline("2026-11-01T00:00:00Z"), { ok: false });
});
