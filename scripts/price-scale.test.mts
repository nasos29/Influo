// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/price-scale.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { formatEuro, formatEuroAmount } from "../lib/formatEuro.ts";
import {
  budgetTierMatches,
  formatFromPriceLabel,
  lowestListedPrice,
  priceTierFromMinRate,
} from "../lib/publicInfluencer.ts";

function labelFor(price: number, lang: "el" | "en" = "el") {
  return formatFromPriceLabel(price, lang);
}

test("guest labels use the exact amount, not a tier floor", () => {
  assert.equal(labelFor(40), "Από 40 €");
  assert.equal(labelFor(40, "en"), "From 40 €");
  assert.equal(labelFor(49), "Από 49 €");
  assert.equal(labelFor(49, "en"), "From 49 €");
  assert.equal(labelFor(50), "Από 50 €");
  assert.equal(labelFor(80), "Από 80 €");
  assert.equal(labelFor(100), "Από 100 €");
  assert.equal(labelFor(100, "en"), "From 100 €");
  assert.equal(labelFor(200), "Από 200 €");
  assert.equal(labelFor(200, "en"), "From 200 €");
  assert.equal(labelFor(300), "Από 300 €");
  assert.equal(labelFor(500), "Από 500 €");
  assert.equal(labelFor(1000), "Από 1.000 €");
  assert.equal(labelFor(1000, "en"), "From 1,000 €");
  assert.equal(labelFor(2000), "Από 2.000 €");
  assert.equal(labelFor(4999), "Από 4.999 €");
  assert.equal(labelFor(5000), "Από 5.000 €");
  assert.equal(labelFor(5000, "en"), "From 5,000 €");
  assert.equal(labelFor(6000), "Από 6.000 €");
  for (const label of [labelFor(40), labelFor(100), labelFor(200, "en")]) {
    assert.equal(/Έως|Up to|Από έως|From up to/i.test(label || ""), false);
  }
});

test("empty rate card falls back to min_rate", () => {
  const row = { min_rate: "100", rate_card: {}, service_packages: [] };
  assert.equal(lowestListedPrice(row), 100);
  assert.equal(formatFromPriceLabel(lowestListedPrice(row), "el"), "Από 100 €");
  assert.equal(formatFromPriceLabel(lowestListedPrice(row), "en"), "From 100 €");
  assert.equal(priceTierFromMinRate(lowestListedPrice(row)), "200");
});

test("cheapest service wins over a higher min_rate", () => {
  const row = {
    min_rate: "200",
    rate_card: { story: "40", reel: "200" },
    service_packages: [],
  };
  assert.equal(lowestListedPrice(row), 40);
  assert.equal(formatFromPriceLabel(lowestListedPrice(row)), "Από 40 €");
});

test("a range uses its lower bound for Από and budget, not joined digits", () => {
  const row = {
    min_rate: "500",
    rate_card: { post: "100-300", reel: "120-300", story: "30 - 100", youtube: "500" },
    service_packages: [],
  };
  assert.equal(lowestListedPrice(row), 30);
  assert.equal(formatFromPriceLabel(lowestListedPrice(row)), "Από 30 €");
  assert.equal(priceTierFromMinRate(lowestListedPrice(row)), "50");
  assert.equal(budgetTierMatches(priceTierFromMinRate("30–100"), "50"), true);
  assert.equal(priceTierFromMinRate("100-300"), "200");
});

test("euro sign stays to the right of the amount", () => {
  for (const label of [labelFor(50), labelFor(200, "en"), formatEuro(1000), formatEuro(1000, "en")]) {
    assert.equal(label?.endsWith("€"), true);
    assert.equal(/€\d/.test(label || ""), false);
    assert.match(label || "", / €$/);
  }
  assert.equal(formatEuro(50), "50 €");
  assert.equal(formatEuro(1000), "1.000 €");
  assert.equal(formatEuro(1000, "en"), "1,000 €");
  assert.equal(formatEuroAmount("€200", "en"), "200 €");
  assert.equal(formatEuroAmount("1.500"), "1.500 €");
});

test("directory filter follows the half-open caps", () => {
  assert.equal(budgetTierMatches(priceTierFromMinRate("49"), "50"), true);
  assert.equal(budgetTierMatches(priceTierFromMinRate("50"), "50"), false);
  assert.equal(budgetTierMatches(priceTierFromMinRate("50"), "100"), true);
  assert.equal(budgetTierMatches(priceTierFromMinRate("200"), "200"), false);
  assert.equal(budgetTierMatches(priceTierFromMinRate("200"), "300"), true);
  assert.equal(budgetTierMatches(priceTierFromMinRate("5000"), "5000"), true);
  assert.equal(budgetTierMatches(priceTierFromMinRate("5001"), "5000"), false);
  assert.equal(budgetTierMatches(priceTierFromMinRate("5001"), "Unlimited"), true);
});
