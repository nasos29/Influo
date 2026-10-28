// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/cpm.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { bestAvgViews, estimateCpm, formatCpmEuro } from "../lib/cpm.ts";

test("estimateCpm: min_rate / avg_views * 1000 with 2-decimal rounding", () => {
  assert.equal(estimateCpm("100", 10000), 10);
  assert.equal(estimateCpm(150, "5k"), 30);
  assert.equal(estimateCpm("99,5", 1000), 99.5);
  assert.equal(formatCpmEuro(10), "10.00€");
  assert.equal(formatCpmEuro(12.5), "12.50€");
});

test("estimateCpm: missing rate or views < 100 → null", () => {
  assert.equal(estimateCpm(null, 5000), null);
  assert.equal(estimateCpm("", 5000), null);
  assert.equal(estimateCpm("ask", 5000), null);
  assert.equal(estimateCpm("100", 99), null);
  assert.equal(estimateCpm("100", 0), null);
  assert.equal(estimateCpm("100", null), null);
});

test("bestAvgViews picks the highest parsed account views", () => {
  assert.equal(bestAvgViews(null), 0);
  assert.equal(bestAvgViews([]), 0);
  assert.equal(
    bestAvgViews([
      { avg_views: "800" },
      { avg_views: "12k" },
      { avg_views: null },
      { avg_views: "2.5k" },
    ]),
    12000
  );
});
