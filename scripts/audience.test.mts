// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/audience.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { displayAudienceTopAge, isValidAgeRange } from "../lib/audience.ts";

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

test("displayAudienceTopAge uses ? for missing and don't-know placeholders", () => {
  assert.equal(displayAudienceTopAge(null), "?");
  assert.equal(displayAudienceTopAge(undefined), "?");
  assert.equal(displayAudienceTopAge(""), "?");
  assert.equal(displayAudienceTopAge("   "), "?");
  assert.equal(displayAudienceTopAge("?"), "?");
  assert.equal(displayAudienceTopAge("Δεν την ξέρουμε"), "?");
  assert.equal(displayAudienceTopAge("δεν την ξερουμε"), "?");
  assert.equal(displayAudienceTopAge("We don't know"), "?");
  assert.equal(displayAudienceTopAge("We don't know it"), "?");
  assert.equal(displayAudienceTopAge("Unknown"), "?");
});

test("displayAudienceTopAge keeps entered age groups", () => {
  assert.equal(displayAudienceTopAge("18-24"), "18-24");
  assert.equal(displayAudienceTopAge(" 35-44 "), "35-44");
  assert.equal(displayAudienceTopAge("45+"), "45+");
});
