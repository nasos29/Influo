// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/audience.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  AUDIENCE_NO_ACCESS,
  displayAudienceTopAge,
  hasAudienceDemographics,
  hasAudienceRequirement,
  isAudienceNoAccess,
  isValidAgeRange,
  parseGenderPercent,
  validateAudienceInput,
} from "../lib/audience.ts";

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



test("isAudienceNoAccess and displayAudienceTopAge hide the sentinel", () => {
  assert.equal(isAudienceNoAccess(AUDIENCE_NO_ACCESS), true);
  assert.equal(isAudienceNoAccess(" no_access "), true);
  assert.equal(isAudienceNoAccess("18-24"), false);
  assert.equal(displayAudienceTopAge("18-24"), "18-24");
  assert.equal(displayAudienceTopAge(AUDIENCE_NO_ACCESS), "?");
  assert.equal(displayAudienceTopAge(""), "?");
  assert.equal(displayAudienceTopAge("?"), "?");
  assert.equal(displayAudienceTopAge(null), "?");
});

test("hasAudienceDemographics requires a valid range and a 100% split", () => {
  assert.equal(
    hasAudienceDemographics({ audience_top_age: "18-24", audience_male_percent: 40, audience_female_percent: 60 }),
    true
  );
  assert.equal(
    hasAudienceDemographics({ audience_top_age: "18-24", audience_male_percent: 0, audience_female_percent: 0 }),
    false
  );
  assert.equal(
    hasAudienceDemographics({ audience_top_age: "", audience_male_percent: 40, audience_female_percent: 60 }),
    false
  );
  assert.equal(
    hasAudienceDemographics({ audience_top_age: AUDIENCE_NO_ACCESS, audience_male_percent: null, audience_female_percent: null }),
    false
  );
});

test("hasAudienceRequirement treats personal-account opt-out as complete", () => {
  assert.equal(hasAudienceRequirement({ audience_top_age: AUDIENCE_NO_ACCESS }), true);
  assert.equal(hasAudienceRequirement({ audience_top_age: "18-24", audience_male_percent: 30, audience_female_percent: 70 }), true);
  assert.equal(hasAudienceRequirement({ audience_top_age: null, audience_male_percent: 0, audience_female_percent: 0 }), false);
});

test("validateAudienceInput accepts opt-out or a complete split", () => {
  const skipped = validateAudienceInput({ noAccess: true, male: "", female: "", topAge: "" }, "el");
  assert.equal(skipped.ok, true);
  if (skipped.ok) {
    assert.equal(skipped.payload.audience_top_age, AUDIENCE_NO_ACCESS);
    assert.equal(skipped.payload.audience_male_percent, null);
  }

  const ok = validateAudienceInput({ noAccess: false, male: "35", female: "65", topAge: "18-24" }, "en");
  assert.equal(ok.ok, true);

  const missing = validateAudienceInput({ noAccess: false, male: "", female: "", topAge: "" }, "el");
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.match(missing.error, /Δεν έχω πρόσβαση/);
  }

  const sum = validateAudienceInput({ noAccess: false, male: "40", female: "40", topAge: "18-24" }, "en");
  assert.equal(sum.ok, false);
  if (!sum.ok) {
    assert.match(sum.error, /add up to 100/);
  }

  const age = validateAudienceInput({ noAccess: false, male: "50", female: "50", topAge: "12" }, "en");
  assert.equal(age.ok, false);
  if (!age.ok) {
    assert.match(age.error, /18-24/);
  }
});

test("parseGenderPercent accepts 0–100 integers only", () => {
  assert.equal(parseGenderPercent("0"), 0);
  assert.equal(parseGenderPercent("100"), 100);
  assert.equal(parseGenderPercent("40.5"), null);
  assert.equal(parseGenderPercent(""), null);
  assert.equal(parseGenderPercent("101"), null);
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
