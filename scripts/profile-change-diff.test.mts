import test from "node:test";
import assert from "node:assert/strict";
import { diffProfileChange } from "../lib/profileChangeDiff.ts";

test("accounts are diffed per platform, internal keys hidden, flag as note", () => {
  const out = diffProfileChange(
    ["accounts", "bio", "location"],
    { accounts: [{ platform: "Instagram", username: "a", followers: "1.5k", posts_count: 120 }], bio: "x", location: "Αθήνα" },
    { accounts: [{ platform: "Instagram", username: "a", followers: "1.6k", posts_count: 130, er_suspicious: true, er_flag_reason: "inflated" }, { platform: "TikTok", username: "t" }], bio: "y", location: "Αθήνα" }
  );
  assert.equal(out.length, 2);
  const acc = out[0];
  assert.deepEqual(acc.lines.map((l) => `${l.label}: ${l.from} → ${l.to}`), [
    "Instagram followers: 1.5k → 1.6k",
    "Instagram posts: 120 → 130",
    "TikTok: (δεν υπήρχε) → νέος: t",
  ]);
  assert.equal(acc.notes.length, 1);
  assert.match(acc.notes[0], /inflated/);
  assert.equal(out[1].lines[0].to, "y");
});
