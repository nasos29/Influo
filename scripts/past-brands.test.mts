// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/past-brands.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { aggregatePastBrands } from "../lib/pastBrands.ts";

test("aggregatePastBrands keeps only completed rows when status is present", () => {
  const map = aggregatePastBrands([
    { influencer_id: "a", brand_name: "Alpha", status: "completed" },
    { influencer_id: "a", brand_name: "Beta", status: "accepted" },
    { influencer_id: "a", brand_name: "Gamma", status: "pending" },
    { influencer_id: "a", brand_name: "Delta", status: "rejected" },
  ]);
  assert.deepEqual(map.get("a"), ["Alpha"]);
  assert.equal(map.has("b"), false);
});

test("aggregatePastBrands returns distinct brand names per influencer", () => {
  const map = aggregatePastBrands([
    { influencer_id: "a", brand_name: "Cafe", status: "completed" },
    { influencer_id: "a", brand_name: "Cafe", status: "completed" },
    { influencer_id: "a", brand_name: "  Cafe  ", status: "completed" },
    { influencer_id: "a", brand_name: "Deli", status: "completed" },
    { influencer_id: "b", brand_name: "Cafe", status: "completed" },
    { influencer_id: "b", brand_name: "Gym", status: "COMPLETED" },
  ]);
  assert.deepEqual(map.get("a"), ["Cafe", "Deli"]);
  assert.deepEqual(map.get("b"), ["Cafe", "Gym"]);
});

test("aggregatePastBrands skips empty names and ids", () => {
  const map = aggregatePastBrands([
    { influencer_id: "a", brand_name: "", status: "completed" },
    { influencer_id: "a", brand_name: "   ", status: "completed" },
    { influencer_id: "", brand_name: "Solo", status: "completed" },
    { influencer_id: null, brand_name: "Solo", status: "completed" },
    { influencer_id: "a", brand_name: "Real", status: "completed" },
  ]);
  assert.deepEqual(map.get("a"), ["Real"]);
  assert.equal(map.size, 1);
});

test("aggregatePastBrands accepts rows already filtered (no status field)", () => {
  const map = aggregatePastBrands([
    { influencer_id: "x", brand_name: "One" },
    { influencer_id: "x", brand_name: "Two" },
    { influencer_id: "x", brand_name: "One" },
  ]);
  assert.deepEqual(map.get("x"), ["One", "Two"]);
});
