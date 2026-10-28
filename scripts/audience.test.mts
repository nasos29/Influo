// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/audience.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { isValidAgeRange } from "../lib/audience.ts";

test("isValidAgeRange accepts NN-NN variants with 13≤from<to≤80", () => {
  assert.equal(isValidAgeRange("18-24"), true);
  assert.equal(isValidAgeRange("25–34"), true);
  assert.equal(isValidAgeRange("18 - 24"), true);
  assert.equal(isValidAgeRange("18--24"), true);
  assert.equal(isValidAgeRange("18/24"), true);
  assert.equal(isValidAgeRange("13-80"), true);
});

test("isValidAgeRange accepts NN+ with 13–80", () => {
  assert.equal(isValidAgeRange("45+"), true);
  assert.equal(isValidAgeRange("13+"), true);
  assert.equal(isValidAgeRange("80+"), true);
});

test("isValidAgeRange rejects singles, empty, ?, and out-of-range", () => {
  assert.equal(isValidAgeRange(""), false);
  assert.equal(isValidAgeRange("?"), false);
  assert.equal(isValidAgeRange(null), false);
  assert.equal(isValidAgeRange("1"), false);
  assert.equal(isValidAgeRange("17"), false);
  assert.equal(isValidAgeRange("12-18"), false);
  assert.equal(isValidAgeRange("18-18"), false);
  assert.equal(isValidAgeRange("18-81"), false);
  assert.equal(isValidAgeRange("12+"), false);
  assert.equal(isValidAgeRange("81+"), false);
});
