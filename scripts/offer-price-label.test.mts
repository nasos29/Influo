// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/offer-price-label.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { offerPriceLabel } from "../lib/offerPriceLabel.ts";
import { packageRowTitle } from "../lib/servicePackages.ts";
import { inviteHeading, negotiateLead } from "../lib/creatorAddress.ts";
import { campaignChoiceLine, closesInLabel } from "../lib/campaignChoiceMeta.ts";

test("everyone sees the exact service price, with the euro sign after it", () => {
  assert.equal(offerPriceLabel({ price: "120", priceTier: "200", lang: "el" }), "120 €");
  assert.equal(offerPriceLabel({ price: "50", priceTier: "100", lang: "el" }), "50 €");
  assert.equal(
    offerPriceLabel({ price: "90", priceTier: "100", suffix: "/ φωτογραφία", lang: "el" }),
    "90 € / φωτογραφία"
  );
});

test("a stored range stays on the service card and does not join the digits", () => {
  assert.equal(offerPriceLabel({ price: "30-100", fromPrice: 30, priceMax: 100, lang: "el" }), "30–100 €");
  assert.equal(offerPriceLabel({ price: "30 - 100", lang: "el" }), "30–100 €");
  assert.equal(offerPriceLabel({ price: "30–100", lang: "en" }), "30–100 €");
  assert.equal(offerPriceLabel({ fromPrice: 120, priceMax: 300, lang: "el" }), "120–300 €");
  assert.equal(/Από|From/.test(offerPriceLabel({ price: "500", lang: "el" }) || ""), false);
});

test("a package without a price string still shows the exact amount", () => {
  assert.equal(offerPriceLabel({ price: "", fromPrice: 40, lang: "el" }), "40 €");
  assert.equal(offerPriceLabel({ fromPrice: 40, lang: "el" }), "40 €");
  assert.equal(offerPriceLabel({ fromPrice: 40, suffix: "/ μήνα", lang: "el" }), "40 € / μήνα");
  assert.equal(offerPriceLabel({ fromPrice: 0, lang: "el" }), null);
});

test("package row titles drop a leading 1 and keep UGC and carousel", () => {
  assert.equal(packageRowTitle("instagram", "reel", 1, "el"), "Instagram Reel");
  assert.equal(packageRowTitle("tiktok", "video", 1, "el"), "TikTok Video");
  assert.equal(packageRowTitle("instagram", "story", 1, "el"), "Instagram Story");
  assert.equal(packageRowTitle("instagram", "carousel", 1, "el"), "Instagram Carousel");
  assert.equal(packageRowTitle("ugc", "ugc_video", 1, "el"), "UGC βίντεο");
  assert.equal(packageRowTitle("instagram", "story", 3, "el"), "3 Instagram Stories");
});

test("invite heading follows the creator's Greek name", () => {
  assert.equal(inviteHeading("Θεοδώρα Γκιόκα", "Female", "el"), "Πρόσκληση της Θεοδώρας σε καμπάνια");
  assert.equal(inviteHeading("Γιώργος Παππάς", "Male", "el"), "Πρόσκληση του Γιώργου σε καμπάνια");
  assert.equal(negotiateLead("Θεοδώρα Γκιόκα", "Female", "el"), "Στείλε στη Θεοδώρα τη δική σου πρόταση.");
  assert.equal(inviteHeading("Maria Stone", "Female", "en"), "Invite Maria to a campaign");
});

test("campaign line uses euro after the amount and days until close", () => {
  const now = new Date("2026-10-01T12:00:00").getTime();
  assert.equal(closesInLabel("2026-10-19", "el", now), "Κλείνει σε 18 μέρες");
  assert.equal(
    campaignChoiceLine({ status: "open", budget: 50, deadline: "2026-10-19", lang: "el", now }),
    "Ανοιχτή · 50 € · Κλείνει σε 18 μέρες"
  );
  assert.equal(
    campaignChoiceLine({ status: "draft", budget: 0, deadline: null, lang: "el", now }),
    "Πρόχειρη"
  );
});
