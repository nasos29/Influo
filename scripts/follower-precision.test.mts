import assert from "node:assert/strict";
import test from "node:test";
import {
  computeFollowerGrowth,
  isFollowerCompositionBreak,
  matchedFollowerTotals,
} from "../lib/followerGrowth.ts";
import {
  formatFollowers,
  isCoarseFollowerRounding,
  preferPreciseFollowers,
} from "../lib/socialRefresh.ts";

test("formatFollowers keeps exact integers under 1M", () => {
  assert.equal(formatFollowers(13300), "13300");
  assert.equal(formatFollowers(13000), "13000");
  assert.equal(formatFollowers(1_200_000), "1.2M");
});

test("preferPreciseFollowers keeps 13300 over rounded 13k", () => {
  assert.equal(preferPreciseFollowers("13300", "13k"), "13300");
  assert.equal(preferPreciseFollowers("13.3k", "13k"), "13300");
  assert.equal(preferPreciseFollowers("13k", "14k"), "14000");
  assert.equal(isCoarseFollowerRounding(13000, 13300), true);
  assert.equal(isCoarseFollowerRounding(14000, 13300), false);
});

test("composition break detects lost-account cliffs", () => {
  assert.equal(isFollowerCompositionBreak(44100, 28100), true);
  assert.equal(isFollowerCompositionBreak(28100, 28500), false);
  assert.equal(isFollowerCompositionBreak(30000, 29000), false);
});

test("growth ignores lost Instagram account cliff for Dimitrios-like history", () => {
  const now = Date.parse("2026-11-05T12:00:00Z");
  const result = computeFollowerGrowth(
    [
      { total: 40900, at: Date.parse("2026-10-04T10:00:00Z") },
      { total: 42500, at: Date.parse("2026-10-11T10:00:00Z") },
      { total: 44100, at: Date.parse("2026-11-04T18:42:00Z") },
      { total: 28100, at: Date.parse("2026-11-04T18:50:00Z") },
    ],
    [{ platform: "tiktok", username: "dimitristzampazis0", followers: 28100 }],
    28100,
    now
  );
  assert.ok(result);
  assert.equal(result!.growth, 0);
  assert.equal(result!.oldTotal, 28100);
});

test("matchedFollowerTotals compares only shared platforms", () => {
  const matched = matchedFollowerTotals(
    [{ platform: "tiktok", username: "a", followers: 28100 }],
    [
      { platform: "tiktok", username: "a", followers: 27000 },
      { platform: "instagram", username: "b", followers: 16000 },
    ]
  );
  assert.ok(matched);
  assert.equal(matched!.baseline, 27000);
  assert.equal(matched!.current, 28100);
});
