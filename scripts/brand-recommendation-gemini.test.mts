import assert from "node:assert/strict";
import test from "node:test";
import { brandProfileHash, parseGeminiRecommendation } from "../lib/brandRecommendationGemini.ts";

const allowed = ["a", "b", "c"];

test("a ranking keeps only candidate ids and exactly three reasons in each language", () => {
  const ranking = parseGeminiRecommendation(
    {
      influencers: [
        {
          id: "a",
          reasons_el: ["Ένας", "Δύο", "Τρεις", "Τέταρτος"],
          reasons_en: ["One", "Two", "Three", "Four"],
        },
        {
          id: "missing",
          reasons_el: ["Ένας", "Δύο", "Τρεις"],
          reasons_en: ["One", "Two", "Three"],
        },
        {
          id: "b",
          reasons_el: ["Μόνο ένας", "Δύο"],
          reasons_en: ["Only one", "Two", "Three"],
        },
        {
          id: "c",
          reasons_el: ["Κατηγορία", "Δεξιότητα", "Πόλη"],
          reasons_en: ["Category", "Skill", "City"],
        },
      ],
    },
    allowed
  );
  assert.deepEqual(
    ranking.map((row) => row.id),
    ["a", "c"]
  );
  assert.deepEqual(ranking[0].reasonsEl, ["Ένας", "Δύο", "Τρεις"]);
  assert.equal(ranking[0].reasonsEn.length, 3);
  assert.equal(ranking[1].reasonsEl.length, 3);
});

test("the brand hash changes when the profile text changes", () => {
  const base = { name: "Acme", industry: "Food", bio: "Cafe", city: "Athens", instagram: "", website: "" };
  assert.equal(brandProfileHash(base), brandProfileHash({ ...base }));
  assert.notEqual(brandProfileHash(base), brandProfileHash({ ...base, bio: "Restaurant" }));
});
