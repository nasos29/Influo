import assert from "node:assert/strict";
import test from "node:test";
import { buildMatchReasons, placesMatch, recommendInfluencers, type InfluencerProfile } from "../lib/recommendations.ts";

const brand = {
  id: "brand-1",
  brand_name: "Acme",
  industry: "Fashion & Style",
  category: "Fashion & Style",
  contact_email: "brand@example.com",
  location: "Αθήνα",
  brief: "Θέλουμε UGC στα ελληνικά για Instagram.",
  campaigns: [
    { title: "Summer", budget: 200, platforms: ["instagram", "tiktok"], location: "Athens" },
  ],
};

const creator: InfluencerProfile = {
  id: "inf-1",
  display_name: "Eleni",
  category: "Fashion & Style",
  categories: ["Fashion & Style"],
  engagement_rate: { instagram: "4.2%" },
  followers_count: "12k",
  min_rate: "180",
  from_price: 80,
  location: "Athens",
  languages: ["Ελληνικά", "English"],
  skills: ["ugc", "vlogs"],
  accounts: [
    { platform: "instagram", followers: "12K" },
    { platform: "youtube", followers: "1K" },
  ],
  past_brands: ["Nike"],
  verified: true,
  auditpr_audit: {
    positives: ["Δυνατό κοινό στη μόδα"],
    whyWorkWithThem: "Δουλεύει καλά με brands μόδας.",
    brandSafe: true,
  },
};

test("athens and αθήνα are the same place", () => {
  assert.equal(placesMatch("Athens", "Αθήνα"), true);
  assert.equal(placesMatch("Athens, Greece", "Paris"), false);
});

test("reasons are specific facts and skip audit copy", () => {
  const reasons = buildMatchReasons(brand, creator, ["ugc"], "el");
  assert.ok(reasons.length >= 2 && reasons.length <= 3);
  assert.ok(reasons.some((line) => line.includes("Μόδα & Στυλ")));
  assert.ok(reasons.some((line) => line.includes("Athens") || line.includes("Αθήνα") || line.includes("Ίδια περιοχή")));
  assert.equal(reasons.some((line) => line.includes("Δυνατό κοινό")), false);
  assert.equal(reasons.some((line) => line.includes("Δουλεύει καλά")), false);
  assert.equal(reasons.some((line) => line.includes("Καλή επιλογή")), false);
  assert.equal(reasons.some((line) => line.includes("Επαληθευμένος")), false);
  assert.equal(reasons.some((line) => /έδρα/i.test(line)), false);
});

test("a price above every campaign budget is not called a fit", () => {
  const reasons = buildMatchReasons(brand, { ...creator, from_price: 500, min_rate: "500" }, [], "en");
  assert.equal(reasons.some((line) => /within/i.test(line)), false);
});

test("a price inside a campaign budget names that campaign", () => {
  const reasons = buildMatchReasons(
    brand,
    { ...creator, location: "Paris", languages: [], skills: [], engagement_rate: "0.4%", past_brands: [] },
    [],
    "en"
  );
  assert.ok(reasons.some((line) => line.includes("From 80 €") && line.includes("Summer") && line.includes("200 €")));
  assert.equal(reasons.some((line) => line.includes("Paris")), false);
  assert.equal(reasons.some((line) => /speak/i.test(line)), false);
  assert.equal(reasons.some((line) => /skill/i.test(line)), false);
});

test("language, skills, platforms and a past collaboration are stated only when true", () => {
  const together = buildMatchReasons(
    {
      ...brand,
      brand_name: "Nike",
      industry: "Food & Drink",
      category: "Food & Drink",
      brief: "Greek creators",
      location: null,
      campaigns: [],
    },
    { ...creator, location: "Paris", from_price: null, min_rate: null, engagement_rate: null, past_brands: ["Nike"] },
    ["ugc"],
    "el"
  );
  assert.ok(together.some((line) => line.includes("Έχετε ήδη συνεργαστεί")));
  assert.ok(together.some((line) => line.includes("Ελληνικά")));
  assert.ok(together.some((line) => line.includes("UGC")));
  assert.equal(together.some((line) => /instagram/i.test(line) && line.includes("καμπάνιες")), false);
});

test("recommendInfluencers does not invent a reason when nothing matches", () => {
  const matches = recommendInfluencers(
    { id: "b", brand_name: "Other", industry: "Tech & Gadgets", category: "Tech & Gadgets", contact_email: "a@b.c" },
    [{ id: "c", display_name: "No data", category: "Food & Drink", location: "Paris" }],
    { minScore: 0, lang: "en" }
  );
  assert.equal(matches.length, 1);
  assert.equal(matches[0].reasons.some((line) => /good fit|verified|value/i.test(line)), false);
  assert.equal(matches[0].reasons.some((line) => line.includes("Paris")), false);
});
