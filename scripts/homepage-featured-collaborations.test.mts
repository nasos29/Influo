import assert from "node:assert/strict";
import test from "node:test";
import { featuredCollaborationPlatform } from "../lib/featuredCollaborationPlatform.ts";
import {
  DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS,
  isCuratedFeaturedCollaborationId,
  parseHomepageFeaturedCollaborationsSetting,
} from "../lib/homepageFeaturedCollaborations.ts";

test("default featured collaborations uses Athos brand and five curated ids including proposal:59", () => {
  assert.equal(DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS.brandId, "4d7f24f5-fa4d-4601-bc6a-6a7da8331d49");
  assert.equal(DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS.applicationIds.length, 5);
  assert.equal(
    DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS.heroApplicationId,
    "a0b953c0-bae2-44d4-9222-d5b5fbc385ab"
  );
  assert.ok(DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS.applicationIds.includes("proposal:59"));
});

test("isCuratedFeaturedCollaborationId accepts UUID and proposal:N", () => {
  assert.ok(isCuratedFeaturedCollaborationId(DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS.applicationIds[0]));
  assert.ok(isCuratedFeaturedCollaborationId("proposal:59"));
  assert.ok(!isCuratedFeaturedCollaborationId("proposal:0"));
  assert.ok(!isCuratedFeaturedCollaborationId("proposal:abc"));
  assert.ok(!isCuratedFeaturedCollaborationId("ghost"));
});

test("featuredCollaborationPlatform detects IG and TikTok from deliverable or source", () => {
  assert.equal(
    featuredCollaborationPlatform("https://www.instagram.com/reel/ABC123/"),
    "instagram"
  );
  assert.equal(
    featuredCollaborationPlatform("https://www.tiktok.com/@u/video/123"),
    "tiktok"
  );
  assert.equal(
    featuredCollaborationPlatform("https://example.com/x", "https://vm.tiktok.com/ZZZZ/"),
    "tiktok"
  );
  assert.equal(featuredCollaborationPlatform("https://youtube.com/watch?v=x"), null);
});

test("parse falls back when value is missing or invalid", () => {
  const missing = parseHomepageFeaturedCollaborationsSetting(undefined);
  assert.deepEqual(missing.applicationIds, DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS.applicationIds);

  const partial = parseHomepageFeaturedCollaborationsSetting({
    heroApplicationId: "not-a-uuid",
    applicationIds: ["ghost", DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS.applicationIds[1], "proposal:59"],
  });
  assert.equal(partial.applicationIds.length, 2);
  assert.ok(partial.applicationIds.includes("proposal:59"));
  assert.equal(partial.heroApplicationId, partial.applicationIds[0]);
});

test("parse keeps proposal hero when listed", () => {
  const parsed = parseHomepageFeaturedCollaborationsSetting({
    heroApplicationId: "proposal:59",
    applicationIds: ["proposal:59", DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS.applicationIds[0]],
  });
  assert.equal(parsed.heroApplicationId, "proposal:59");
});