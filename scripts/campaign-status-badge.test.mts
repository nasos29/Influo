import assert from "node:assert/strict";
import test from "node:test";
import { campaignStatusBadge } from "../lib/campaignStatusBadge.ts";

const now = Date.parse("2026-11-03T12:00:00Z");
test("status badge colours", () => {
  assert.equal(campaignStatusBadge({ status: "open", deadline: "2026-11-10" }, "el", now)?.text, "Ανοιχτή");
  assert.match(campaignStatusBadge({ status: "open", deadline: "2026-11-10" }, "el", now)!.className, /bg-emerald-600 text-white/);
  assert.equal(campaignStatusBadge({ status: "open", deadline: "2026-11-01" }, "el", now)?.text, "Έληξε");
  assert.equal(campaignStatusBadge({ status: "open", slots: 2, slots_filled: 2, deadline: "2026-11-10" }, "el", now)?.text, "Πλήρης");
  for (const c of [{ status: "closed" }, { status: "open", deadline: "2026-11-01" }, { status: "open", slots: 1, slots_filled: 1 }])
    assert.match(campaignStatusBadge(c, "el", now)!.className, /bg-red-600 text-white/);
});
