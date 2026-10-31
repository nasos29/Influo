// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/min-rate.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveMinRate,
  FIXED_PRICE_MESSAGE,
  hasUnfixedCreatorPrice,
  mergeRateCard,
  packageTitle,
  packagesForSave,
  rateCardFromPackages,
  isPositivePriceInput,
  type ServicePackage,
} from "../lib/servicePackages.ts";

test("deriveMinRate uses the smallest positive package or rate-card price", () => {
  assert.equal(
    deriveMinRate(
      [
        { id: "a", platform: "instagram", type: "reel", quantity: 1, price: "200" },
        { id: "b", platform: "instagram", type: "story", quantity: 1, price: "80" },
        { id: "c", platform: "instagram", type: "post", quantity: 1, price: "0" },
        { id: "d", platform: "instagram", type: "post", quantity: 1, price: "" },
      ],
      { reel: "0", youtube: "" }
    ),
    "80"
  );
  assert.equal(deriveMinRate([], { story: "150", reel: "0", post: "ask" }), "150");
  assert.equal(deriveMinRate([], { reel: "0", story: "", post: "ρώτησε" }), null);
  assert.equal(
    deriveMinRate([], { post: "100-300", reel: "120-300", story: "30-100", youtube: "500" }),
    "30"
  );
  assert.equal(deriveMinRate([], { story: "hello", post: "30-10", reel: "ask" }), null);
  assert.equal(deriveMinRate([{ id: "a", platform: "instagram", type: "reel", quantity: 1, price: "-5" }], null), null);
});

test("package prices must be empty or a positive integer", () => {
  assert.equal(isPositivePriceInput(""), true);
  assert.equal(isPositivePriceInput("150"), true);
  assert.equal(isPositivePriceInput("1"), true);
  assert.equal(isPositivePriceInput("0.5"), false);
  assert.equal(isPositivePriceInput("10.0"), false);
  assert.equal(isPositivePriceInput("0"), false);
  assert.equal(isPositivePriceInput("-3"), false);
  assert.equal(isPositivePriceInput("30-100"), false);
  assert.equal(isPositivePriceInput("30–100"), false);
  assert.equal(isPositivePriceInput("30 - 100"), false);
  assert.equal(isPositivePriceInput("abc"), false);

  const saved = packagesForSave([
    { id: "a", platform: "instagram", type: "reel", quantity: 1, price: "0" },
    { id: "b", platform: "instagram", type: "story", quantity: 1, price: "40" },
  ] as ServicePackage[]);
  assert.deepEqual(saved.map((p) => p.price), ["40"]);
});

test("a range is rejected and is not saved as its lower bound", () => {
  assert.equal(FIXED_PRICE_MESSAGE.el, "Βάλε μία σταθερή τιμή, όχι εύρος");
  assert.equal(
    hasUnfixedCreatorPrice([{ price: "30-100" }], { story: "30–100", post: "80" }),
    true
  );
  assert.equal(
    hasUnfixedCreatorPrice([{ price: "80" }], { story: "40", usage_rights_ads: "15" }),
    false
  );
  assert.equal(hasUnfixedCreatorPrice([{ price: "0" }], { reel: "0", post: "" }), false);
  const saved = packagesForSave([
    { id: "a", platform: "instagram", type: "story", quantity: 1, price: "30-100" },
    { id: "b", platform: "instagram", type: "reel", quantity: 1, price: "80" },
  ] as ServicePackage[]);
  assert.deepEqual(saved.map((p) => p.price), ["80"]);
  assert.deepEqual(
    rateCardFromPackages([
      { id: "a", platform: "instagram", type: "story", quantity: 1, price: "30-100" },
      { id: "b", platform: "instagram", type: "reel", quantity: 1, price: "80" },
    ] as ServicePackage[]),
    { reel: "80" }
  );
});

test("ugc and carousel prices lower min_rate; extras never do", () => {
  assert.equal(
    deriveMinRate(
      [
        { id: "a", platform: "instagram", type: "reel", quantity: 1, price: "200" },
        { id: "b", platform: "ugc", type: "ugc_photo", quantity: 4, price: "30" },
        { id: "c", platform: "instagram", type: "carousel", quantity: 1, price: "140" },
      ],
      {
        ugc_video: "90",
        usage_rights_ads: "15",
        link_in_bio: "10",
        event_visit: "20",
      }
    ),
    "30"
  );
  assert.equal(
    deriveMinRate([], { usage_rights_ads: "15", link_in_bio: "10", event_visit: "50" }),
    null
  );
  assert.equal(deriveMinRate([], { ugc_video: "120", carousel: "80", ugc_photo: "0" }), "80");
});

test("saved packages keep ugc off-platform and carousel on Instagram", () => {
  const saved = packagesForSave([
    { id: "v", platform: "instagram", type: "ugc_video", quantity: 1, price: "180", delivery_days: 7, usage_rights: "none", description: "" },
    { id: "ph", platform: "ugc", type: "ugc_photo", quantity: 3, price: "40", delivery_days: 5, usage_rights: "none", description: "" },
    { id: "c", platform: "tiktok", type: "carousel", quantity: 1, price: "95", delivery_days: 4, usage_rights: "none", description: "" },
  ] as ServicePackage[]);
  assert.equal(saved.find((p) => p.type === "ugc_video")?.platform, "ugc");
  assert.equal(saved.find((p) => p.type === "ugc_photo")?.quantity, 3);
  assert.equal(saved.find((p) => p.type === "carousel")?.platform, "instagram");
  assert.equal(packageTitle("ugc", "ugc_video", 1, "el"), "1 UGC βίντεο");
  assert.equal(packageTitle("ugc", "ugc_photo", 3, "en"), "3 UGC photos");
  assert.equal(packageTitle("instagram", "carousel", 1, "el"), "1 Instagram Carousel");

  const card = mergeRateCard(rateCardFromPackages(saved), {
    usage_rights_ads: "60",
    link_in_bio: "",
    event_visit: "0",
  });
  assert.equal(card.ugc_video, "180");
  assert.equal(card.ugc_photo, "40");
  assert.equal(card.carousel, "95");
  assert.equal(card.usage_rights_ads, "60");
  assert.equal("link_in_bio" in card, false);
  assert.equal("event_visit" in card, false);
  assert.equal(deriveMinRate(saved, card), "40");
});
