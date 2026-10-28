// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/similar-influencers.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  followerTotalFromField,
  pickSimilarInfluencers,
  sharedCategoryCount,
} from "../lib/similarInfluencers.ts";

test("followerTotalFromField handles number, string, and map", () => {
  assert.equal(followerTotalFromField(12000), 12000);
  assert.equal(followerTotalFromField("1.5k"), 1500);
  assert.equal(followerTotalFromField({ instagram: "10k", tiktok: 2000 }), 12000);
  assert.equal(followerTotalFromField(null), 0);
});

test("sharedCategoryCount counts overlaps after parse", () => {
  assert.equal(sharedCategoryCount(["Travel", "Food & Drink"], "Travel,Beauty & Makeup"), 1);
  assert.equal(sharedCategoryCount(["Travel"], "Food & Drink"), 0);
});

test("pickSimilarInfluencers ranks by shared cats then followers", () => {
  const rows = [
    {
      id: "a",
      display_name: "A",
      profile_slug: "a",
      avatar_url: null,
      category: "Travel",
      followers: 1000,
      verified: false,
    },
    {
      id: "b",
      display_name: "B",
      profile_slug: "b",
      avatar_url: null,
      category: "Travel,Food & Drink",
      followers: 500,
      verified: true,
    },
    {
      id: "self",
      display_name: "Self",
      profile_slug: "self",
      avatar_url: null,
      category: "Travel,Food & Drink",
      followers: 99999,
      verified: true,
    },
    {
      id: "c",
      display_name: "C",
      profile_slug: "c",
      avatar_url: null,
      category: "Gaming & Esports",
      followers: 80000,
      verified: false,
    },
  ];
  const picked = pickSimilarInfluencers("self", ["Travel", "Food & Drink"], rows, 6);
  assert.deepEqual(
    picked.map((r) => r.id),
    ["b", "a"]
  );
});
