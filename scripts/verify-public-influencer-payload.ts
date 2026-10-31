import assert from "node:assert/strict";
import {
  ageFromBirthDate,
  budgetTierMatches,
  DIRECTORY_BUDGET_CAPS,
  findPrivateFieldPaths,
  formatFromPriceLabel,
  formatPriceTierLabel,
  lowestListedPrice,
  parseDirectoryPrice,
  priceTierFromMinRate,
  toCommercialInfluencer,
  toPublicDirectoryCard,
  toPublicNewlyApproved,
  toPublicProfile,
} from "../lib/publicInfluencer.ts";

/**
 * "Up to X" after the half-open scale: prices below X match, a price equal to
 * a cap below 5000 belongs to the next scale, and 5000+ stays VIP.
 */
function scaleBudgetMatch(minRate: unknown, budgetMax: string): boolean {
  if (!budgetMax || budgetMax === "All") return true;
  const rate = parseDirectoryPrice(minRate);
  if (budgetMax === "Unlimited") return rate >= 5000;
  const max = parseInt(budgetMax, 10);
  if (!Number.isFinite(max)) return true;
  if (!(rate > 0)) return true;
  if (rate > 5000) return false;
  if (rate === 5000) return max >= 5000;
  return rate < max;
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
    const legacy = scaleBudgetMatch(sample, budget);
    const tier = priceTierFromMinRate(sample);
    const next = budgetTierMatches(tier, budget);
    assert.equal(
      next,
      legacy,
      `budget ${budget} for ${JSON.stringify(sample)} tier ${tier}: next ${next} expected ${legacy} parsed ${parseDirectoryPrice(sample)}`
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
  // The reel package is 400. Story 80 on the rate card is still a service, so «Από» uses 80.
  assert.equal(payload.from_price, 80);
  assert.equal(payload.price_tier, "100");
  assert.equal(formatFromPriceLabel(payload.from_price, "el"), "Από 80 €");
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
  from_price?: number | null;
}>;
assert.equal(packages[0].has_price, true);
assert.equal(packages[0].price, "400");
assert.equal(packages[0].platform, "instagram");
assert.equal(packages[0].title, "1 Instagram Reel");
assert.equal(packages[0].price_tier, "500");
assert.equal(packages[0].from_price, 400);
const directory = toPublicDirectoryCard(row);
assert.equal(typeof directory.age, "number");
assert.equal("birth_date" in directory, false);

assert.equal(ageFromBirthDate("2000-10-12", new Date("2026-10-11T12:00:00Z")), 25);
assert.equal(ageFromBirthDate("2000-10-11", new Date("2026-10-11T12:00:00Z")), 26);
assert.equal(ageFromBirthDate("2000-10-11", new Date("2026-10-10T22:30:00Z")), 26);
assert.equal(ageFromBirthDate(""), null);
assert.equal(ageFromBirthDate(null), null);

assert.equal(formatPriceTierLabel("0"), null);
assert.equal(formatPriceTierLabel("50"), "έως 50 €");
assert.equal(formatPriceTierLabel("100"), "50 €–100 €");
assert.equal(formatPriceTierLabel("200"), "100 €–200 €");
assert.equal(formatPriceTierLabel("300"), "200 €–300 €");
assert.equal(formatPriceTierLabel("500"), "300 €–500 €");
assert.equal(formatPriceTierLabel("1000"), "500 €–1.000 €");
assert.equal(formatPriceTierLabel("2000"), "1.000 €–2.000 €");
assert.equal(formatPriceTierLabel("under_5000"), "2.000 €–5.000 €");
assert.equal(formatPriceTierLabel("5000"), "5.000 €+");
assert.equal(formatPriceTierLabel("above_5000"), "5.000 €+");

assert.equal(formatFromPriceLabel("0"), null);
assert.equal(formatFromPriceLabel(0), null);
assert.equal(formatFromPriceLabel(null), null);
assert.equal(formatFromPriceLabel(40, "el"), "Από 40 €");
assert.equal(formatFromPriceLabel(40, "en"), "From 40 €");
assert.equal(formatFromPriceLabel(49, "en"), "From 49 €");
assert.equal(formatFromPriceLabel(50, "el"), "Από 50 €");
assert.equal(formatFromPriceLabel(80, "el"), "Από 80 €");
assert.equal(formatFromPriceLabel(100, "el"), "Από 100 €");
assert.equal(formatFromPriceLabel(100, "en"), "From 100 €");
assert.equal(formatFromPriceLabel(200, "el"), "Από 200 €");
assert.equal(formatFromPriceLabel(1000, "el"), "Από 1.000 €");
assert.equal(formatFromPriceLabel(1000, "en"), "From 1,000 €");
assert.equal(formatFromPriceLabel(5000, "el"), "Από 5.000 €");
assert.equal(formatFromPriceLabel(5000, "en"), "From 5,000 €");
assert.equal(/Από έως|From up to|Έως|Up to/i.test(formatFromPriceLabel(40, "el") || ""), false);
assert.equal(/Από έως|From up to|Έως|Up to/i.test(formatFromPriceLabel(40, "en") || ""), false);
assert.equal(/€\d/.test(formatFromPriceLabel(200, "el") || ""), false);

assert.equal(priceTierFromMinRate("40"), "50");
assert.equal(priceTierFromMinRate("49"), "50");
assert.equal(priceTierFromMinRate("50"), "100");
assert.equal(priceTierFromMinRate("80"), "100");
assert.equal(priceTierFromMinRate("100"), "200");
assert.equal(priceTierFromMinRate("200"), "300");
assert.equal(priceTierFromMinRate("2500"), "under_5000");
assert.equal(priceTierFromMinRate("5000"), "5000");
assert.equal(priceTierFromMinRate("5001"), "above_5000");
assert.equal(formatFromPriceLabel(200, "el"), "Από 200 €");
assert.equal(formatFromPriceLabel(50, "en"), "From 50 €");
assert.equal(formatFromPriceLabel(49, "en"), "From 49 €");
assert.equal(formatFromPriceLabel(lowestListedPrice({ min_rate: "100", rate_card: {}, service_packages: [] })), "Από 100 €");
assert.equal(
  formatFromPriceLabel(
    lowestListedPrice({
      min_rate: "40",
      rate_card: { story: "40", post: "80", reel: "200" },
      service_packages: [],
    })
  ),
  "Από 40 €"
);

// Rate-card fallback when no packages
const rateOnly = toPublicProfile({
  ...row,
  service_packages: [],
  min_rate: "80",
  rate_card: { story: "80", reel: "200" },
});
const ratePkgs = rateOnly.service_packages as Array<{
  type?: string;
  price?: string;
  price_tier?: string;
  from_price?: number | null;
}>;
assert.equal(ratePkgs.length, 2);
assert.equal(ratePkgs.find((p) => p.type === "story")?.price, "80");
assert.equal(ratePkgs.find((p) => p.type === "reel")?.price, "200");
assert.equal(rateOnly.from_price, 80);
assert.equal(formatFromPriceLabel(rateOnly.from_price, "el"), "Από 80 €");
assert.equal(rateOnly.price_tier, "100");
assert.equal(ratePkgs.find((p) => p.type === "reel")?.price_tier, "300");
assert.equal(ratePkgs.find((p) => p.type === "reel")?.from_price, 200);
assert.equal(formatFromPriceLabel(ratePkgs.find((p) => p.type === "reel")?.from_price, "el"), "Από 200 €");

const ugcPhoto = "37";
const ugcVideo = "87";
const carouselPrice = "133";
const adsMonth = "333";
const bioLink = "44";
const eventFee = "777";
const withNew = toPublicProfile({
  ...row,
  min_rate: ugcPhoto,
  rate_card: {
    ugc_video: ugcVideo,
    ugc_photo: ugcPhoto,
    carousel: carouselPrice,
    usage_rights_ads: adsMonth,
    link_in_bio: bioLink,
    event_visit: eventFee,
  },
  service_packages: [
    {
      id: "ugc-v",
      platform: "ugc",
      type: "ugc_video",
      quantity: 1,
      price: ugcVideo,
      delivery_days: 7,
      usage_rights: "none",
      description: "",
    },
    {
      id: "ugc-p",
      platform: "ugc",
      type: "ugc_photo",
      quantity: 3,
      price: ugcPhoto,
      delivery_days: 5,
      usage_rights: "none",
      description: "",
    },
    {
      id: "car",
      platform: "instagram",
      type: "carousel",
      quantity: 1,
      price: carouselPrice,
      delivery_days: 4,
      usage_rights: "none",
      description: "",
    },
  ],
});
const withNewJson = JSON.stringify(withNew);
assert.equal(findPrivateFieldPaths(withNew).length, 0, withNewJson);
assert.equal(withNewJson.includes('"min_rate"'), false);
assert.equal(withNew.from_price, 37);
assert.equal(formatFromPriceLabel(withNew.from_price, "el"), "Από 37 €");
assert.equal(withNew.price_tier, "50");
assert.equal("min_rate" in withNew, false);
const newPkgs = withNew.service_packages as Array<{
  type?: string;
  price?: string;
  platform?: string;
  price_tier?: string;
  from_price?: number | null;
}>;
assert.equal(newPkgs.find((p) => p.type === "ugc_photo")?.platform, "ugc");
assert.equal(newPkgs.find((p) => p.type === "ugc_photo")?.price, ugcPhoto);
assert.equal(newPkgs.find((p) => p.type === "ugc_photo")?.from_price, 37);
assert.equal(newPkgs.find((p) => p.type === "ugc_video")?.price, ugcVideo);
assert.equal(newPkgs.find((p) => p.type === "carousel")?.platform, "instagram");
assert.equal(newPkgs.find((p) => p.type === "carousel")?.price, carouselPrice);
assert.equal(newPkgs.find((p) => p.type === "carousel")?.from_price, 133);
const extras = withNew.service_extras as Array<{
  key?: string;
  price?: string;
  price_tier?: string;
  from_price?: number | null;
  has_price?: boolean;
}>;
assert.deepEqual(
  extras.map((extra) => extra.key),
  ["usage_rights_ads"]
);
assert.equal(extras.find((extra) => extra.key === "usage_rights_ads")?.price, adsMonth);
assert.equal(newPkgs.find((p) => p.type === "bio")?.platform, "other");
assert.equal(newPkgs.find((p) => p.type === "bio")?.price, bioLink);
assert.equal(newPkgs.find((p) => p.type === "bio")?.from_price, 44);
assert.equal(newPkgs.find((p) => p.type === "event")?.price, eventFee);

const commercial = toCommercialInfluencer({
  id: row.id,
  min_rate: ugcPhoto,
  rate_card: {
    ugc_video: ugcVideo,
    usage_rights_ads: adsMonth,
    link_in_bio: bioLink,
    event_visit: eventFee,
  },
  service_packages: [],
});
assert.equal(commercial.min_rate, ugcPhoto);
assert.equal(commercial.rate_card?.ugc_video, ugcVideo);
assert.equal(commercial.rate_card?.link_in_bio, bioLink);
assert.equal(commercial.rate_card?.usage_rights_ads, undefined);
assert.equal(commercial.service_extras.find((extra) => extra.key === "usage_rights_ads")?.price, adsMonth);
assert.equal(commercial.service_packages.find((pkg) => pkg.type === "bio")?.price, bioLink);
assert.equal(commercial.service_packages.find((pkg) => pkg.type === "event")?.price, eventFee);

console.log("public influencer payload checks passed");
