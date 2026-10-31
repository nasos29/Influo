import assert from "node:assert/strict";
import {
  ageFromBirthDate,
  budgetTierMatches,
  DIRECTORY_BUDGET_CAPS,
  findPrivateFieldPaths,
  formatPriceTierLabel,
  parseDirectoryPrice,
  priceTierFromMinRate,
  toPublicDirectoryCard,
  toPublicNewlyApproved,
  toPublicProfile,
} from "../lib/publicInfluencer.ts";

/** The directory budget check before this change. */
function legacyBudgetMatch(minRate: unknown, budgetMax: string): boolean {
  if (!budgetMax || budgetMax === "All") return true;
  const raw = typeof minRate === "string" ? minRate : minRate == null ? "" : String(minRate);
  const rate = raw ? parseFloat(raw.replace(/[^0-9.]/g, "")) : 0;
  if (budgetMax === "Unlimited") return rate >= 5000;
  const max = parseInt(budgetMax, 10);
  if (rate > max) return false;
  return true;
}

const budgets = ["All", ...DIRECTORY_BUDGET_CAPS.map(String), "Unlimited"];
const samples = [
  undefined,
  null,
  "",
  "0",
  "€€",
  "Ρώτησε",
  "50",
  "100",
  "100€",
  "101",
  "150",
  "1.500",
  "1,500",
  "200",
  "300",
  "450",
  "499",
  "500",
  "999",
  "1000",
  "1500",
  "2000",
  "2500",
  "4999",
  "5000",
  "5000€",
  "5000.01",
  "6000",
  "12000",
  1750,
  5000,
];

assert.deepEqual([...DIRECTORY_BUDGET_CAPS], [50, 100, 200, 300, 500, 1000, 2000, 5000]);

for (const sample of samples) {
  for (const budget of budgets) {
    const legacy = legacyBudgetMatch(sample, budget);
    const tier = priceTierFromMinRate(sample);
    const next = budgetTierMatches(tier, budget);
    assert.equal(
      next,
      legacy,
      `budget ${budget} for ${JSON.stringify(sample)} tier ${tier}: next ${next} legacy ${legacy} parsed ${parseDirectoryPrice(sample)}`
    );
  }
}

const secretEmail = "secret.creator@example.com";
const secretBirth = "1996-03-15";
const secretRate = "1750";
const secretAuth = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const row = {
  id: "70fca8a9-1111-2222-3333-444444444444",
  display_name: "Ελένη",
  bio: "Lifestyle creator",
  avatar_url: "https://example.com/a.jpg",
  analytics_verified: true,
  accounts: [{ platform: "Instagram", username: "eleni", followers: "11k", contact_email: secretEmail, token: "sekret" }],
  category: "Lifestyle",
  location: "Αθήνα",
  gender: "Female",
  languages: "Ελληνικά",
  min_rate: secretRate,
  rate_card: { story: "80", post: "150", reel: secretRate },
  service_packages: [
    {
      id: "pkg1",
      platform: "instagram",
      type: "reel",
      quantity: 1,
      price: "400",
      delivery_days: 7,
      usage_rights: "none",
      description: "One reel",
    },
  ],
  birth_date: secretBirth,
  auth_user_id: secretAuth,
  contact_email: secretEmail,
  approval_notes: "internal note",
  analytics_verification_notes: "staff only",
  created_at: "2024-01-01T00:00:00Z",
  total_reviews: 3,
  avg_rating: 4.5,
  availability_status: "available",
  profile_slug: "eleni",
  videos: ["https://example.com/v"],
  auditpr_audit: { brandSafe: true, scoreBreakdown: ["ok"], contact_email: secretEmail },
};

for (const payload of [toPublicDirectoryCard(row), toPublicNewlyApproved(row), toPublicProfile(row)]) {
  const json = JSON.stringify(payload);
  assert.equal(findPrivateFieldPaths(payload).length, 0, json);
  assert.equal(json.includes(secretEmail), false);
  assert.equal(json.includes(secretBirth), false);
  assert.equal(json.includes(secretAuth), false);
  assert.equal(json.includes(secretRate), false);
  assert.equal(json.includes("internal note"), false);
  assert.equal(json.includes("sekret"), false);
  // Cheapest package is 400 → tier 500
  assert.equal(payload.price_tier, "500");
  // past_brands is not a DB column; loaders attach it after toPublic*.
  assert.equal("past_brands" in payload, false);
}

const profile = toPublicProfile(row);
assert.equal(profile.has_min_rate, true);
assert.equal(profile.has_priced_min_rate, true);
assert.deepEqual(profile.rate_card_flags, { story: true, post: true, reel: true });
const packages = profile.service_packages as Array<{
  has_price?: boolean;
  price?: string;
  title?: string;
  platform?: string;
  price_tier?: string;
}>;
assert.equal(packages[0].has_price, true);
assert.equal(packages[0].price, undefined);
assert.equal(packages[0].platform, "instagram");
assert.equal(packages[0].title, "1 Instagram Reel");
assert.equal(packages[0].price_tier, "500");
assert.equal("price" in packages[0] && packages[0].price != null, false);
const directory = toPublicDirectoryCard(row);
assert.equal(typeof directory.age, "number");
assert.equal("birth_date" in directory, false);

assert.equal(ageFromBirthDate("2000-10-12", new Date("2026-10-11T12:00:00Z")), 25);
assert.equal(ageFromBirthDate("2000-10-11", new Date("2026-10-11T12:00:00Z")), 26);
assert.equal(ageFromBirthDate("2000-10-11", new Date("2026-10-10T22:30:00Z")), 26);
assert.equal(ageFromBirthDate(""), null);
assert.equal(ageFromBirthDate(null), null);

assert.equal(formatPriceTierLabel("0"), null);
assert.equal(formatPriceTierLabel("50"), "έως €50");
assert.equal(formatPriceTierLabel("100"), "€50–€100");
assert.equal(formatPriceTierLabel("200"), "€100–€200");
assert.equal(formatPriceTierLabel("300"), "€200–€300");
assert.equal(formatPriceTierLabel("500"), "€300–€500");
assert.equal(formatPriceTierLabel("1000"), "€500–€1.000");
assert.equal(formatPriceTierLabel("2000"), "€1.000–€2.000");
assert.equal(formatPriceTierLabel("under_5000"), "€2.000–€5.000");
assert.equal(formatPriceTierLabel("5000"), "€5.000+");
assert.equal(formatPriceTierLabel("above_5000"), "€5.000+");

assert.equal(priceTierFromMinRate("40"), "50");
assert.equal(priceTierFromMinRate("50"), "50");
assert.equal(priceTierFromMinRate("51"), "100");
assert.equal(priceTierFromMinRate("2500"), "under_5000");
assert.equal(priceTierFromMinRate("5000"), "5000");
assert.equal(priceTierFromMinRate("5001"), "above_5000");

// Rate-card fallback when no packages
const rateOnly = toPublicProfile({
  ...row,
  service_packages: [],
  min_rate: "80",
  rate_card: { story: "80", reel: "200" },
});
const ratePkgs = rateOnly.service_packages as Array<{ type?: string; price?: string; price_tier?: string }>;
assert.equal(ratePkgs.length, 2);
assert.equal(ratePkgs[0].price, undefined);
assert.equal(rateOnly.price_tier, "100"); // cheapest 80 → 100

console.log("public influencer payload checks passed");
