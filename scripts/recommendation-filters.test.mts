import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_RECOMMENDATION_FILTERS,
  RECOMMENDATION_MIN_SCORE,
  activeRecommendationFilterCount,
  filterRecommendationProfiles,
  recommendationFollowerCount,
  type RecommendationFilterState,
} from "../lib/recommendationFilters.ts";
import type { InfluencerProfile } from "../lib/recommendations.ts";

function creator(overrides: Partial<InfluencerProfile> = {}): InfluencerProfile {
  return {
    id: "1",
    display_name: "Μαρία",
    categories: ["Fashion & Style"],
    location: "Αθήνα",
    from_price: 80,
    skills: ["ugc"],
    followers_count: "12000",
    accounts: [{ platform: "instagram", followers: "12000" }],
    ...overrides,
  };
}

function filters(overrides: Partial<RecommendationFilterState> = {}): RecommendationFilterState {
  return { ...EMPTY_RECOMMENDATION_FILTERS, ...overrides };
}

test("active filter count is zero until a control is set", () => {
  assert.equal(activeRecommendationFilterCount(EMPTY_RECOMMENDATION_FILTERS), 0);
  assert.equal(
    activeRecommendationFilterCount(filters({ category: "Food & Drink", skills: ["ugc", "vlogs"], maxPrice: 80 })),
    3
  );
});

test("minimum score stays at 40 and is not a filter field", () => {
  assert.equal(RECOMMENDATION_MIN_SCORE, 40);
  assert.equal("minScore" in EMPTY_RECOMMENDATION_FILTERS, false);
});

test("category, platform, skills, price and audience narrow the list", () => {
  const rows = [
    creator(),
    creator({
      id: "2",
      display_name: "Νίκος",
      categories: ["Tech & Gadgets"],
      skills: ["video_editing"],
      from_price: 200,
      accounts: [{ platform: "tiktok", followers: "150000" }],
      followers_count: "150000",
      location: "Θεσσαλονίκη",
    }),
    creator({
      id: "3",
      display_name: "Ελένη",
      skills: ["copywriting", "ugc"],
      from_price: null,
      accounts: [{ platform: "instagram", followers: "4000" }],
      followers_count: "4000",
    }),
  ];

  assert.deepEqual(
    filterRecommendationProfiles(rows, filters({ category: "Fashion & Style" })).map((row) => row.id),
    ["1", "3"]
  );
  assert.deepEqual(
    filterRecommendationProfiles(rows, filters({ platform: "tiktok" })).map((row) => row.id),
    ["2"]
  );
  assert.deepEqual(
    filterRecommendationProfiles(rows, filters({ skills: ["ugc", "video_editing"] })).map((row) => row.id),
    ["1", "2", "3"]
  );
  assert.deepEqual(
    filterRecommendationProfiles(rows, filters({ skills: ["copywriting"] })).map((row) => row.id),
    ["3"]
  );
  assert.deepEqual(
    filterRecommendationProfiles(rows, filters({ maxPrice: 100 })).map((row) => row.id),
    ["1"]
  );
  assert.deepEqual(
    filterRecommendationProfiles(rows, filters({ audience: "micro" })).map((row) => row.id),
    ["1"]
  );
  assert.deepEqual(
    filterRecommendationProfiles(rows, filters({ audience: "macro", platform: "tiktok" })).map((row) => row.id),
    ["2"]
  );
  assert.equal(recommendationFollowerCount(rows[1], "tiktok"), 150000);
  assert.equal(
    filterRecommendationProfiles(rows, filters({ location: "αθηνα" })).every((row) => row.location === "Αθήνα"),
    true
  );
});
