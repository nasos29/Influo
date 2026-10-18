import assert from "node:assert/strict";
import test from "node:test";
import { recommendInfluencers, sharedCategoryKeys } from "../lib/recommendations.ts";

const fashionBrand = {
  id: "brand-1",
  brand_name: "Atelier",
  industry: "Fashion & Style",
  contact_email: "brand@example.com",
};

test("shared categories ignore a brand niche the creator does not list", () => {
  assert.deepEqual(
    sharedCategoryKeys("Fashion & Style", ["Lifestyle", "Food & Drink", "Travel"]),
    []
  );
  assert.deepEqual(sharedCategoryKeys("Fashion & Style", ["Fashion & Style", "Beauty"]), ["Fashion & Style"]);
});

test("a lifestyle creator is not described as a fashion match", () => {
  const [match] = recommendInfluencers(
    fashionBrand,
    [
      {
        id: 1,
        display_name: "Alex",
        categories: ["Lifestyle", "Food & Drink", "Travel"],
        engagement_rate: "2.1%",
        auditpr_audit: { niche: "Fashion & Style", niche_en: "Fashion & Style" },
      },
    ],
    { minScore: 0, lang: "el" }
  );
  assert.ok(match);
  const text = match.reasons.join(" | ");
  assert.equal(text.includes("Μόδα"), false);
  assert.equal(text.includes("Fashion"), false);
  assert.equal(text.includes("ΤΕΛΕΙΟ"), false);
  assert.match(text, /Lifestyle|Φαγητό|Ταξίδια/);
  assert.ok((match.strengths.categoryMatch ?? 1) <= 0.55);
});

test("real category overlap is named and clipped", () => {
  const [match] = recommendInfluencers(
    fashionBrand,
    [
      {
        id: 2,
        display_name: "Bea",
        categories: ["Fashion & Style", "Beauty"],
        engagement_rate: "3%",
      },
    ],
    { minScore: 0, lang: "el" }
  );
  assert.ok(match);
  assert.match(match.reasons[0], /Κοινές κατηγορίες/);
  assert.match(match.reasons[0], /Μόδα & Στυλ/);
  assert.ok(match.reasons.every((reason) => reason.length <= 96));
});
