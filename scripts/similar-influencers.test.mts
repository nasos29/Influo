// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/similar-influencers.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  categoryIlikeOrFilter,
  escapePostgrestOrValue,
  followerTotalFromAccounts,
  pickSimilarInfluencers,
  sharedCategoryCount,
  shuffle,
  type SimilarInfluencerRow,
} from "../lib/similarInfluencers.ts";

test("escapePostgrestOrValue escapes %, commas, and parentheses", () => {
  assert.equal(escapePostgrestOrValue("Beauty%"), "Beauty\\%");
  assert.equal(escapePostgrestOrValue("A,B"), "A\\,B");
  assert.equal(escapePostgrestOrValue("Foo (Bar)"), "Foo \\(Bar\\)");
});

test("categoryIlikeOrFilter builds or-clause with ilike per category", () => {
  assert.equal(
    categoryIlikeOrFilter(["Beauty & Makeup", "Travel"]),
    "category.ilike.%Beauty & Makeup%,category.ilike.%Travel%"
  );
  assert.equal(categoryIlikeOrFilter(["", "  "]), null);
  assert.equal(
    categoryIlikeOrFilter(["Food (Demo)"]),
    "category.ilike.%Food \\(Demo\\)%"
  );
});

test("followerTotalFromAccounts sums parseFollowerString per account", () => {
  assert.equal(
    followerTotalFromAccounts([
      { platform: "instagram", followers: "10k" },
      { platform: "tiktok", followers: 2000 },
    ]),
    12000
  );
  assert.equal(followerTotalFromAccounts([{ followers: "1.5k" }]), 1500);
  assert.equal(followerTotalFromAccounts(null), 0);
  assert.equal(followerTotalFromAccounts([]), 0);
  assert.equal(followerTotalFromAccounts("nope"), 0);
});

test("sharedCategoryCount counts overlaps after parse", () => {
  assert.equal(sharedCategoryCount(["Travel", "Food & Drink"], "Travel,Beauty & Makeup"), 1);
  assert.equal(sharedCategoryCount(["Travel"], "Food & Drink"), 0);
});

test("shuffle is deterministic with injected random and preserves membership", () => {
  const seq = [0.9, 0.1, 0.5, 0.2, 0.8];
  let i = 0;
  const random = () => seq[i++ % seq.length]!;
  const input = ["a", "b", "c", "d"];
  const once = shuffle(input, random);
  assert.equal(once.length, 4);
  assert.deepEqual([...once].sort(), ["a", "b", "c", "d"]);
  assert.notDeepEqual(once, input); // shuffled (not same order for this seq)
  assert.deepEqual(input, ["a", "b", "c", "d"]); // input untouched
});

function sampleRows(): SimilarInfluencerRow[] {
  return [
    {
      id: "a",
      display_name: "A",
      profile_slug: "a",
      avatar_url: null,
      category: "Travel",
      accounts: [{ followers: 1000 }],
      verified: false,
    },
    {
      id: "b",
      display_name: "B",
      profile_slug: "b",
      avatar_url: null,
      category: "Travel,Food & Drink",
      accounts: [{ followers: 500 }],
      verified: true,
    },
    {
      id: "self",
      display_name: "Self",
      profile_slug: "self",
      avatar_url: null,
      category: "Travel,Food & Drink",
      accounts: [{ followers: 99999 }],
      verified: true,
    },
    {
      id: "c",
      display_name: "C",
      profile_slug: "c",
      avatar_url: null,
      category: "Gaming & Esports",
      accounts: [{ followers: 80000 }],
      verified: false,
    },
    {
      id: "d",
      display_name: "D",
      profile_slug: "d",
      avatar_url: null,
      category: "Food & Drink",
      accounts: [{ followers: 300 }],
      verified: false,
    },
    {
      id: "e",
      display_name: "E",
      profile_slug: "e",
      avatar_url: null,
      category: "Travel",
      accounts: [{ followers: 50 }],
      verified: false,
    },
    {
      id: "f",
      display_name: "F",
      profile_slug: "f",
      avatar_url: null,
      category: "Travel,Beauty & Makeup",
      accounts: [{ followers: 10 }],
      verified: false,
    },
  ];
}

test("pickSimilarInfluencers excludes self, requires shared category, respects limit", () => {
  const cats = ["Travel", "Food & Drink"];
  const rows = sampleRows();
  // Always pick index 0 in Fisher–Yates → stable reverse-ish order for asserts on set membership
  const random = () => 0;
  const picked = pickSimilarInfluencers("self", cats, rows, 3, random);

  assert.ok(picked.length <= 3);
  assert.equal(picked.length, 3);
  assert.ok(!picked.some((r) => r.id === "self"));
  assert.ok(!picked.some((r) => r.id === "c")); // Gaming only — no shared cat
  for (const row of picked) {
    assert.ok(
      sharedCategoryCount(cats, row.category) > 0,
      `${row.id} must share a category`
    );
  }

  const allEligible = pickSimilarInfluencers("self", cats, rows, 99, random);
  assert.deepEqual(
    allEligible.map((r) => r.id).sort(),
    ["a", "b", "d", "e", "f"]
  );
});

test("pickSimilarInfluencers returns empty without categories or rows", () => {
  assert.deepEqual(pickSimilarInfluencers("self", [], sampleRows(), 6), []);
  assert.deepEqual(pickSimilarInfluencers("self", ["Travel"], [], 6), []);
  assert.deepEqual(pickSimilarInfluencers("", ["Travel"], sampleRows(), 6), []);
});
