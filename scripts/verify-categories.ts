import assert from "node:assert/strict";
import { recommendInfluencers, type InfluencerProfile } from "../lib/recommendations.ts";
import {
  CATEGORIES,
  categoryLabel,
  categoryTranslations,
  formatStoredCategories,
  parseStoredCategories,
  categoriesMatchFilter,
} from "../lib/categories.ts";

assert.ok(CATEGORIES.includes("Unboxing"));
assert.equal(categoryTranslations.Unboxing.el, "Unboxing");
assert.equal(categoryTranslations.Unboxing.en, "Unboxing");
assert.equal(categoryLabel("Beauty", "el"), "Ομορφιά & Μακιγιάζ");
assert.equal(categoryLabel("Μόδα & Στυλ", "en"), "Fashion & Style");
assert.equal(categoryLabel("unboxing", "el"), "Unboxing");
assert.equal(formatStoredCategories(["Beauty", "Unboxing", "Beauty"]), "Beauty & Makeup,Unboxing");
assert.deepEqual(parseStoredCategories("Fashion & Style"), ["Fashion & Style"]);
assert.deepEqual(parseStoredCategories("Lifestyle,Fashion & Style"), ["Lifestyle", "Fashion & Style"]);
assert.equal(categoriesMatchFilter("Beauty, Tech", "Tech & Gadgets"), true);
assert.equal(categoriesMatchFilter("Γενικά", "Unboxing"), false);

const brand = {
  id: "brand-1",
  brand_name: "Acme",
  industry: "Beauty,Unboxing",
  category: "Beauty,Unboxing",
  contact_email: "brand@example.com",
};

const unboxingCreator = {
  id: "inf-u",
  display_name: "Niki",
  category: "Unboxing",
  categories: ["Unboxing"],
  engagement_rate: "4%",
  followers_count: "20k",
  min_rate: "200",
  verified: true,
} as InfluencerProfile;

const fashionCreator = {
  ...unboxingCreator,
  id: "inf-f",
  display_name: "Eleni",
  category: "Fashion & Style",
  categories: ["Fashion & Style"],
} as InfluencerProfile;

const matches = recommendInfluencers(brand, [unboxingCreator, fashionCreator], {
  minScore: 0,
  limit: 5,
  lang: "el",
});
assert.equal(matches[0].influencer.display_name, "Niki");
assert.ok(matches[0].score > matches[1].score);

const single = recommendInfluencers(
  { ...brand, industry: "Fashion & Style", category: "Fashion & Style" },
  [fashionCreator],
  { minScore: 0, limit: 5, lang: "en" }
);
assert.equal(single.length, 1);
assert.equal(typeof single[0].reasons[0], "string");

console.log("categories ok", matches[0].score, single[0].score);
