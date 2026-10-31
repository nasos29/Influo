// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/package-platforms.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { lowestListedPrice, toPublicProfile } from "../lib/publicInfluencer.ts";
import {
  creatorServicePricesFromStored,
  packageBlurb,
  packageTitle,
  packagesForViewer,
  packagesFromCreatorPrices,
  rateCardFromPackages,
  type PublicPackageView,
} from "../lib/servicePackages.ts";

const card = { story: "30", post: "80", reel: "120", youtube: "500", facebook: "40" };

test("Instagram accounts keep Post, Reel and Story, and hide YouTube without a channel", () => {
  const packages = packagesForViewer([], card, [{ platform: "Instagram", username: "a" }]);
  assert.deepEqual(
    packages.map((pkg) => `${pkg.platform}:${pkg.type}:${pkg.price}`),
    ["instagram:story:30", "instagram:post:80", "instagram:reel:120"]
  );
  assert.equal(packageTitle("instagram", "reel", 1, "en"), "1 Instagram Reel");
  assert.equal(packageTitle("instagram", "story", 1, "el"), "1 Instagram Story");
});

test("TikTok-only creators see one TikTok Video from the reel price", () => {
  const packages = packagesForViewer([], card, [{ platform: "TikTok", username: "a" }]);
  assert.deepEqual(
    packages.map((pkg) => packageTitle(pkg.platform, pkg.type, pkg.quantity, "en")),
    ["1 TikTok Video"]
  );
  assert.equal(packages[0]?.price, "120");
  assert.equal(packageBlurb("tiktok", "video", "el"), "Βίντεο που ανεβαίνει στο TikTok.");
  assert.equal(
    lowestListedPrice({ rate_card: card, min_rate: "500", accounts: [{ platform: "TikTok" }] }),
    120
  );
});

test("TikTok without a reel uses the post price and still hides stories", () => {
  const packages = packagesForViewer([], { story: "30", post: "80", youtube: "500" }, [
    { platform: "TikTok" },
  ]);
  assert.equal(packages.length, 1);
  assert.equal(packages[0]?.platform, "tiktok");
  assert.equal(packages[0]?.type, "video");
  assert.equal(packages[0]?.price, "80");
  assert.equal(
    lowestListedPrice({
      rate_card: { story: "30" },
      min_rate: "500",
      accounts: [{ platform: "TikTok" }],
    }),
    500
  );
});

test("YouTube is shown only with a YouTube account", () => {
  const both = packagesForViewer([], card, [{ platform: "TikTok" }, { platform: "YouTube" }]);
  assert.deepEqual(
    both.map((pkg) => packageTitle(pkg.platform, pkg.type, 1, "en")),
    ["1 TikTok Video", "1 YouTube Video"]
  );
  assert.equal(
    lowestListedPrice({ rate_card: card, min_rate: "9", accounts: [{ platform: "YouTube" }] }),
    500
  );
});

test("an explicit tiktok key stays a TikTok Video next to Instagram", () => {
  const packages = packagesForViewer([], { story: "10", reel: "20", tiktok: "30", youtube: "40" }, [
    { platform: "Instagram" },
    { platform: "TikTok" },
  ]);
  assert.deepEqual(
    packages.map((pkg) => packageTitle(pkg.platform, pkg.type, 1, "en")),
    ["1 Instagram Story", "1 Instagram Reel", "1 TikTok Video"]
  );
  assert.equal(packages.find((pkg) => pkg.platform === "tiktok")?.price, "30");
});

test("TikTok-only prefers the tiktok key over a legacy reel", () => {
  const packages = packagesForViewer([], { reel: "20", tiktok: "30", story: "10" }, [{ platform: "TikTok" }]);
  assert.equal(packages.length, 1);
  assert.equal(packages[0]?.price, "30");
  assert.equal(packageTitle(packages[0]!.platform, packages[0]!.type, 1, "en"), "1 TikTok Video");
});

test("the price form writes a tiktok key and prefills TikTok-only from the old reel", () => {
  const prefilled = creatorServicePricesFromStored([], { reel: "90", story: "15" }, [{ platform: "TikTok" }]);
  assert.equal(prefilled.tiktok, "90");
  assert.equal(prefilled.story, "15");
  const saved = packagesFromCreatorPrices(
    { ...prefilled, tiktok: "90", ugc_video: "40" },
    [{ platform: "TikTok" }]
  );
  assert.deepEqual(rateCardFromPackages(saved), { tiktok: "90", ugc_video: "40" });
  assert.equal(saved.find((pkg) => pkg.platform === "tiktok")?.type, "video");
});

test("YouTube Short and TikTok Story follow the account and set the from-price", () => {
  const accounts = [{ platform: "TikTok" }, { platform: "YouTube" }];
  const packages = packagesForViewer(
    [],
    { tiktok: "100", tiktok_story: "25", youtube: "400", youtube_short: "60", facebook: "15" },
    accounts
  );
  assert.deepEqual(
    packages.map((pkg) => packageTitle(pkg.platform, pkg.type, 1, "en")),
    ["1 TikTok Video", "1 TikTok Story", "1 YouTube Video", "1 YouTube Short"]
  );
  assert.equal(packages.some((pkg) => pkg.platform === "facebook"), false);
  assert.equal(lowestListedPrice({ rate_card: { tiktok_story: "25", youtube_short: "60", facebook: "10" }, min_rate: "500", accounts }), 25);
  const saved = packagesFromCreatorPrices(
    {
      ...creatorServicePricesFromStored([], { tiktok_story: "25", youtube_short: "60" }, accounts),
      tiktok: "",
      youtube: "",
    },
    accounts
  );
  assert.deepEqual(rateCardFromPackages(saved), { tiktok_story: "25", youtube_short: "60" });
});

test("new services follow the account, other services count, and add-ons do not", () => {
  const accounts = [{ platform: "Instagram" }, { platform: "TikTok" }, { platform: "YouTube" }];
  const card = {
    carousel: "70",
    ig_live: "90",
    collab_post: "110",
    story_link: "40",
    tiktok_live: "55",
    spark_ads: "75",
    yt_integration: "300",
    ugc_photo: "20",
    event_visit: "150",
    link_in_bio: "15",
    giveaway: "35",
    usage_rights_ads: "8",
    exclusivity: "5",
    raw_footage: "12",
    rush_delivery: "9",
    facebook: "4",
  };
  const packages = packagesForViewer([], card, accounts);
  assert.deepEqual(
    packages.map((pkg) => packageTitle(pkg.platform, pkg.type, 1, "en")),
    [
      "1 UGC photo",
      "Event appearance",
      "Link in bio",
      "Giveaway",
      "1 Instagram Carousel",
      "1 Instagram Live",
      "1 Instagram Collab post",
      "1 Instagram Story with link",
      "1 TikTok Live",
      "1 TikTok Spark Ads",
      "1 YouTube Integration",
    ]
  );
  assert.equal(packages.some((pkg) => pkg.platform === "facebook"), false);
  assert.equal(lowestListedPrice({ rate_card: card, min_rate: "500", accounts }), 15);
  assert.equal(
    lowestListedPrice({
      rate_card: { usage_rights_ads: "8", exclusivity: "5", facebook: "4" },
      min_rate: "500",
      accounts,
    }),
    500
  );
  const hidden = packagesForViewer([], { ig_live: "90", spark_ads: "30", yt_integration: "40" }, [
    { platform: "TikTok" },
  ]);
  assert.deepEqual(
    hidden.map((pkg) => packageTitle(pkg.platform, pkg.type, 1, "en")),
    ["1 TikTok Spark Ads"]
  );
});

test("no recognized account leaves the rate card unchanged", () => {
  const packages = packagesForViewer([], card, []);
  assert.equal(packages.find((pkg) => pkg.type === "story")?.platform, "instagram");
  assert.equal(packages.find((pkg) => pkg.type === "video")?.platform, "youtube");
});

test("a public TikTok profile lists the video and prices only that service", () => {
  const profile = toPublicProfile({
    accounts: [{ platform: "TikTok", username: "v" }],
    min_rate: "500",
    rate_card: card,
    service_packages: [],
  });
  const packages = profile.service_packages as PublicPackageView[];
  assert.equal(packages.length, 1);
  assert.equal(packages[0]?.platform, "tiktok");
  assert.equal(packages[0]?.type, "video");
  assert.equal(profile.from_price, 120);
});
