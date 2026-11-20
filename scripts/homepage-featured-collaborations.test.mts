import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS,
  parseHomepageFeaturedCollaborationsSetting,
} from "../lib/homepageFeaturedCollaborations.ts";

test("default featured collaborations uses Athos brand and four application ids", () => {
  assert.equal(DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS.brandId, "4d7f24f5-fa4d-4601-bc6a-6a7da8331d49");
  assert.equal(DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS.applicationIds.length, 4);
  assert.equal(
    DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS.heroApplicationId,
    "a0b953c0-bae2-44d4-9222-d5b5fbc385ab"
  );
});

test("parse falls back when value is missing or invalid", () => {
  const missing = parseHomepageFeaturedCollaborationsSetting(undefined);
  assert.deepEqual(missing.applicationIds, DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS.applicationIds);

  const partial = parseHomepageFeaturedCollaborationsSetting({
    heroApplicationId: "not-a-uuid",
    applicationIds: ["ghost", DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS.applicationIds[1]],
  });
  assert.equal(partial.applicationIds.length, 1);
  assert.equal(partial.heroApplicationId, partial.applicationIds[0]);
});