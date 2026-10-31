// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/parse-price.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { formatEuro } from "../lib/formatEuro.ts";
import { offerPriceLabel } from "../lib/offerPriceLabel.ts";
import {
  formatListedPrice,
  formatPriceSpan,
  isListedPrice,
  listedPriceMin,
  parseListedPrice,
} from "../lib/parsePrice.ts";
import {
  budgetTierMatches,
  formatFromPriceLabel,
  lowestListedPrice,
  priceTierFromMinRate,
  toPublicProfile,
} from "../lib/publicInfluencer.ts";
import {
  deriveMinRate,
  isPositivePriceInput,
  type PublicPackageView,
} from "../lib/servicePackages.ts";

const POLYXENI = {
  min_rate: "500",
  rate_card: { post: "100-300", reel: "120-300", story: "30-100", youtube: "500" },
  service_packages: [],
};

test("single amounts: number, currency, thousands, decimals", () => {
  assert.deepEqual(parseListedPrice(30), { min: 30, max: null });
  assert.deepEqual(parseListedPrice("30"), { min: 30, max: null });
  assert.deepEqual(parseListedPrice("30 €"), { min: 30, max: null });
  assert.deepEqual(parseListedPrice("€30"), { min: 30, max: null });
  assert.deepEqual(parseListedPrice("30€"), { min: 30, max: null });
  assert.equal(listedPriceMin("1.000"), 1000);
  assert.equal(listedPriceMin("1,000"), 1000);
  assert.equal(listedPriceMin("1.000 €"), 1000);
  assert.equal(listedPriceMin("1,000.50"), 1000.5);
  assert.equal(listedPriceMin("12,50"), 12.5);
  assert.equal(listedPriceMin("12.50"), 12.5);
  assert.equal(listedPriceMin(0.5), 0.5);
  assert.equal(formatListedPrice("€30", "el"), "30 €");
  assert.equal(formatListedPrice(1000, "el"), "1.000 €");
  assert.equal(formatListedPrice("1,000", "en"), "1,000 €");
});

test("ranges keep the span and use the lower bound", () => {
  for (const raw of ["30-100", "30 - 100", "30–100", "30 — 100", "€30 - 100 €"]) {
    assert.deepEqual(parseListedPrice(raw), { min: 30, max: 100 }, raw);
  }
  assert.equal(listedPriceMin("100-300"), 100);
  assert.equal(listedPriceMin("1.000 - 2.000"), 1000);
  assert.equal(listedPriceMin("1,000–1,500"), 1000);
  assert.equal(formatListedPrice("30-100", "el"), "30–100 €");
  assert.equal(formatListedPrice("30 – 100", "en"), "30–100 €");
  assert.equal(formatListedPrice("1.000-2.000", "el"), "1.000–2.000 €");
  assert.equal(formatListedPrice("1,000 - 2,000", "en"), "1,000–2,000 €");
  assert.equal(formatPriceSpan(30, 100, "el"), "30–100 €");
  assert.equal(formatFromPriceLabel(listedPriceMin("30-100"), "el"), "Από 30 €");
  assert.equal(formatFromPriceLabel("100-300", "el"), "Από 100 €");
  assert.equal(formatFromPriceLabel("120 - 300", "en"), "From 120 €");
});

test("invalid prices are ignored, including digit-joined ranges", () => {
  for (const raw of ["", "   ", "ask", "Ρώτησε", "ρωτησε", "hello", "€", "30-", "-30", "30-10", "0", "0-100", 0, -5, null, undefined]) {
    assert.equal(parseListedPrice(raw), null, JSON.stringify(raw));
    assert.equal(isListedPrice(raw), false);
    assert.equal(listedPriceMin(raw), null);
  }
  assert.equal(listedPriceMin("30-100"), 30);
  assert.notEqual(listedPriceMin("30-100"), 30100);
  assert.notEqual(listedPriceMin("100-300"), 100300);
});

test("polyxeni rate card: cards show the span, min and filters use 30", () => {
  assert.equal(lowestListedPrice(POLYXENI), 30);
  assert.equal(formatEuro(lowestListedPrice(POLYXENI) || 0, "el"), "30 €");
  assert.equal(formatFromPriceLabel(lowestListedPrice(POLYXENI), "el"), "Από 30 €");
  assert.equal(priceTierFromMinRate(lowestListedPrice(POLYXENI)), "50");
  assert.equal(budgetTierMatches(priceTierFromMinRate(lowestListedPrice(POLYXENI)), "50"), true);
  assert.equal(deriveMinRate(POLYXENI.service_packages, POLYXENI.rate_card), "30");

  const profile = toPublicProfile(POLYXENI);
  assert.equal(profile.from_price, 30);
  assert.equal(profile.price_tier, "50");
  const packages = profile.service_packages as PublicPackageView[];
  const story = packages.find((pkg) => pkg.type === "story");
  const post = packages.find((pkg) => pkg.type === "post");
  const reel = packages.find((pkg) => pkg.type === "reel");
  const youtube = packages.find((pkg) => pkg.type === "video");
  assert.equal(story?.from_price, 30);
  assert.equal(story?.price_max, 100);
  assert.equal(story?.price, "30-100");
  assert.equal(
    offerPriceLabel({ price: story?.price, fromPrice: story?.from_price, priceMax: story?.price_max, lang: "el" }),
    "30–100 €"
  );
  assert.equal(post?.from_price, 100);
  assert.equal(post?.price_max, 300);
  assert.equal(
    offerPriceLabel({ price: post?.price, fromPrice: post?.from_price, priceMax: post?.price_max, lang: "el" }),
    "100–300 €"
  );
  assert.equal(reel?.from_price, 120);
  assert.equal(reel?.price_max, 300);
  assert.equal(
    offerPriceLabel({ price: reel?.price, fromPrice: reel?.from_price, priceMax: reel?.price_max, lang: "el" }),
    "120–300 €"
  );
  assert.equal(youtube?.from_price, 500);
  assert.equal(youtube?.price_max, null);
  assert.equal(
    offerPriceLabel({ price: youtube?.price, fromPrice: youtube?.from_price, lang: "el" }),
    "500 €"
  );
});

test("creator price form accepts only one positive integer", () => {
  assert.equal(isPositivePriceInput(""), true);
  assert.equal(isPositivePriceInput("150"), true);
  assert.equal(isPositivePriceInput("1"), true);
  assert.equal(isPositivePriceInput("0.5"), false);
  assert.equal(isPositivePriceInput("30-100"), false);
  assert.equal(isPositivePriceInput("30 - 100"), false);
  assert.equal(isPositivePriceInput("30–100"), false);
  assert.equal(isPositivePriceInput("30 €"), false);
  assert.equal(isPositivePriceInput("€30"), false);
  assert.equal(isPositivePriceInput("abc"), false);
  assert.equal(isPositivePriceInput("0"), false);
});
