import assert from "node:assert/strict";
import test from "node:test";
import {
  computeFollowerGrowth,
  isFollowerCompositionBreak,
  isSameFollowerDisplayBucket,
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
  // Era after the lost-account cliff is younger than 7 days: no valid baseline, metric hidden.
  assert.equal(result, null);
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

test("growth ignores 1.1k rounding noise like Pinelopi 1120→1100", () => {
  const now = Date.parse("2026-11-05T12:00:00Z");
  const result = computeFollowerGrowth(
    [
      { total: 1120, at: Date.parse("2026-11-01T16:47:00Z") },
      { total: 1100, at: Date.parse("2026-11-01T16:54:00Z") },
      { total: 1100, at: Date.parse("2026-11-02T17:57:00Z") },
    ],
    [{ platform: "instagram", username: "pinelopi_zerzi", followers: 1100 }],
    1100,
    now
  );
  // Baseline younger than 7 days: hidden rather than a noisy %.
  assert.equal(result, null);
  assert.equal(isSameFollowerDisplayBucket(1120, 1100), true);
  assert.equal(isSameFollowerDisplayBucket(13300, 13000), false);
});

test("growth hidden when an account was added inside the window (Evangelia)", () => {
  const now = Date.parse("2026-11-08T16:00:00Z");
  const result = computeFollowerGrowth(
    [
      { total: 1500, at: Date.parse("2026-11-08T12:36:00Z"), accounts: [{ platform: "tiktok", username: "e", followers: 1500 }] },
      { total: 3965, at: Date.parse("2026-11-08T12:37:00Z"), accounts: [{ platform: "tiktok", username: "e", followers: 1500 }, { platform: "instagram", username: "e", followers: 2465 }] },
    ],
    [{ platform: "tiktok", username: "e", followers: 1488 }, { platform: "instagram", username: "e", followers: 2463 }],
    3951,
    now
  );
  assert.equal(result, null);
});

test("growth compares only accounts present in both snapshots", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");
  const result = computeFollowerGrowth(
    [{ total: 1500, at: Date.parse("2026-11-01T12:00:00Z"), accounts: [{ platform: "tiktok", username: "e", followers: 1500 }] }],
    [{ platform: "tiktok", username: "e", followers: 1600 }, { platform: "instagram", username: "e", followers: 2463 }],
    4063,
    now
  );
  assert.ok(result);
  assert.equal(result!.oldTotal, 1500);
  assert.equal(result!.growth, 100);
});
