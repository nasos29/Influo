import test from "node:test";
import assert from "node:assert/strict";
import { diffProfileChange, isLowRiskOnlyProfileChange } from "../lib/profileChangeDiff.ts";

test("accounts are diffed per platform, internal keys hidden, flag as note", () => {
  const out = diffProfileChange(
    ["accounts", "bio", "location"],
    { accounts: [{ platform: "Instagram", username: "a", followers: "1.5k", posts_count: 120 }], bio: "x", location: "Αθήνα" },
    { accounts: [{ platform: "Instagram", username: "a", followers: "1.6k", posts_count: 130, er_suspicious: true, er_flag_reason: "inflated" }, { platform: "TikTok", username: "t" }], bio: "y", location: "Αθήνα" }
  );
  assert.equal(out.length, 3);
  const acc = out[0];
  assert.deepEqual(acc.lines.map((l) => `${l.label}: ${l.from} → ${l.to}`), [
    "Instagram followers: 1.5k → 1.6k",
    "Instagram posts: 120 → 130",
    "TikTok: (δεν υπήρχε) → νέος: t",
  ]);
  assert.equal(acc.notes.length, 1);
  assert.match(acc.notes[0], /inflated/);
  assert.equal(out[1].lines[0].to, "y");
  assert.equal(out[2].lines[0].from, "Αθήνα");
  assert.equal(out[2].lines[0].to, "Αθήνα");
});

test("skills diff shows added/removed with Greek labels", () => {
  const out = diffProfileChange(
    ["skills"],
    { skills: ["ugc"] },
    { skills: ["ugc", "video_editing"] }
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].lines.length, 1);
  assert.equal(out[0].lines[0].label, "Προστέθηκε");
  assert.equal(out[0].lines[0].to, "Μοντάζ");
});

test("every changed field is rendered even when JSON equal after sanitization", () => {
  const out = diffProfileChange(["location"], { location: "Αθήνα" }, { location: "Αθήνα" });
  assert.equal(out.length, 1);
  assert.equal(out[0].lines[0].from, "Αθήνα");
  assert.equal(out[0].lines[0].to, "Αθήνα");
});

test("skills-only change is low risk", () => {
  assert.equal(isLowRiskOnlyProfileChange(["skills"]), true);
  assert.equal(isLowRiskOnlyProfileChange(["skills", "bio"]), false);
});
