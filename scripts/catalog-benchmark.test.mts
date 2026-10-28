// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/catalog-benchmark.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCatalogBenchmark,
  engagementFromAccounts,
  erPercentile,
  isUsablePeerEr,
  median,
  type BenchmarkPeer,
} from "../lib/catalogBenchmark.ts";
import { weightedEngagementPercent } from "../lib/channelScore.ts";

test("weightedEngagementPercent weights by followers", () => {
  assert.equal(
    weightedEngagementPercent(
      { instagram: 1000, tiktok: 3000 },
      { instagram: "10%", tiktok: "2%" }
    ),
    // (10*1000 + 2*3000) / 4000 = 4
    4
  );
  assert.equal(weightedEngagementPercent({ instagram: 0 }, { instagram: "10%" }), 0);
  assert.equal(weightedEngagementPercent({ instagram: 1000 }, { instagram: "0%" }), 0);
});

test("engagementFromAccounts uses the same weighted definition", () => {
  const er = engagementFromAccounts([
    { platform: "instagram", followers: "1k", engagement_rate: "10" },
    { platform: "tiktok", followers: "3k", engagement_rate: "2" },
  ]);
  assert.equal(er, 4);
});

test("median ignores order and averages even lengths", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test("isUsablePeerEr excludes outliers and flagged", () => {
  assert.equal(isUsablePeerEr(10), true);
  assert.equal(isUsablePeerEr(25), true);
  assert.equal(isUsablePeerEr(25.1), false);
  assert.equal(isUsablePeerEr(30), false);
  assert.equal(isUsablePeerEr(10, true), false);
  assert.equal(isUsablePeerEr(0), false);
});

test("buildCatalogBenchmark excludes self, outliers, flagged; uses median + percentile", () => {
  const peers: BenchmarkPeer[] = [
    { id: "self", followers: 8_000, er: 5 },
    { id: "a", followers: 7_000, er: 4 },
    { id: "b", followers: 9_000, er: 6 },
    { id: "c", followers: 8_500, er: 8 },
    { id: "d", followers: 6_000, er: 2 },
    { id: "e", followers: 7_500, er: 10 },
    { id: "outlier", followers: 8_000, er: 40 },
    { id: "flagged", followers: 8_000, er: 7, erFlagged: true },
    { id: "macro", followers: 300_000, er: 3 },
  ];

  const bench = buildCatalogBenchmark(
    "self",
    [{ platform: "tiktok", followers: "8k", engagement_rate: "5" }],
    peers
  );

  assert.equal(bench.thisEr, 5);
  assert.equal(bench.thisErFlagged, false);
  assert.equal(bench.peerCount, 5); // a–e; not self/outlier/flagged/macro
  assert.equal(bench.peerAvgEr, 6); // median of [2,4,6,8,10]
  assert.equal(bench.catalogCount, 6); // peers usable incl. macro; self/outlier/flagged out
  assert.equal(bench.percentile, 40); // 2 of 5 peers strictly below 5
  assert.equal(bench.delta, -1); // 5 - 6
});

test("erPercentile is share strictly below thisEr", () => {
  assert.equal(erPercentile(5, [1, 2, 5, 8]), 50);
  assert.equal(erPercentile(5, []), null);
});

test("whole-catalog compare when peerCount < 5", () => {
  const peers: BenchmarkPeer[] = [
    { id: "a", followers: 7_000, er: 4 },
    { id: "b", followers: 9_000, er: 6 },
    { id: "macro", followers: 300_000, er: 3 },
  ];
  const bench = buildCatalogBenchmark(
    "self",
    [{ platform: "tiktok", followers: "8k", engagement_rate: "5" }],
    peers
  );
  assert.ok(bench.peerCount < 5);
  assert.equal(bench.catalogAvgEr, median([4, 6, 3]));
  assert.equal(bench.percentile, erPercentile(5, [4, 6, 3]));
});
