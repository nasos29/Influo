// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/cpm.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { averageAvgViews, estimateCpm, formatCpmEuro, platformVideoCpms } from "../lib/cpm.ts";

test("estimateCpm: min_rate / avg_views * 1000 with 2-decimal rounding", () => {
  assert.equal(estimateCpm("100", 10000), 10);
  assert.equal(estimateCpm(150, "5k"), 30);
  assert.equal(estimateCpm("99,5", 1000), 99.5);
  assert.equal(formatCpmEuro(10), "10,00 €");
  assert.equal(formatCpmEuro(12.5), "12,50 €");
  assert.equal(formatCpmEuro(12.5, "en"), "12.50 €");
});

test("estimateCpm: missing rate or views < 100 → null", () => {
  assert.equal(estimateCpm(null, 5000), null);
  assert.equal(estimateCpm("", 5000), null);
  assert.equal(estimateCpm("ask", 5000), null);
  assert.equal(estimateCpm("100", 99), null);
  assert.equal(estimateCpm("100", 0), null);
  assert.equal(estimateCpm("100", null), null);
});

test("CPM uses the video price and views of the same platform", () => {
  const vasiliki = platformVideoCpms({
    accounts: [{ platform: "TikTok", avg_views: "459" }],
    rate_card: { post: "80", reel: "100", story: "30", youtube: "50" },
    service_packages: [],
  });
  assert.deepEqual(
    vasiliki.map((row) => row.platform),
    ["tiktok"]
  );
  assert.equal(vasiliki[0]?.price, 100);
  assert.equal(vasiliki[0]?.cpm, 217.86);
  assert.equal(formatCpmEuro(vasiliki[0]!.cpm, "el"), "217,86 €");

  const polyxeni = platformVideoCpms({
    accounts: [{ platform: "Instagram", avg_views: "3346" }],
    rate_card: { post: "200", reel: "210", story: "65", youtube: "500" },
    service_packages: [],
  });
  assert.deepEqual(
    polyxeni.map((row) => [row.platform, row.price, row.cpm]),
    [["instagram", 210, 62.76]]
  );
  assert.equal(formatCpmEuro(polyxeni[0]!.cpm, "el"), "62,76 €");

  const akis = platformVideoCpms({
    accounts: [
      { platform: "Instagram", avg_views: null },
      { platform: "TikTok", avg_views: "3542" },
    ],
    rate_card: { reel: "300", story: "50", youtube: "400" },
    service_packages: [],
  });
  assert.deepEqual(akis, []);
});

test("a platform without a video price or with views under 100 is omitted", () => {
  const rows = platformVideoCpms({
    accounts: [
      { platform: "Instagram", avg_views: "80" },
      { platform: "YouTube", avg_views: "5000" },
      { platform: "TikTok", avg_views: "2000" },
    ],
    rate_card: {
      story: "10",
      reel: "40",
      youtube_short: "15",
      ugc_video: "5",
      link_in_bio: "8",
      usage_rights_ads: "3",
      min_rate: "1",
    },
    service_packages: [],
  });
  assert.deepEqual(rows, []);

  const youtube = platformVideoCpms({
    accounts: [{ platform: "YouTube", avg_views: "2000" }],
    rate_card: { youtube: "80", youtube_short: "20", story: "5" },
    service_packages: [],
  });
  assert.equal(youtube.length, 1);
  assert.equal(youtube[0]?.platform, "youtube");
  assert.equal(youtube[0]?.price, 80);
  assert.equal(youtube[0]?.cpm, 40);
});

test("averageAvgViews averages positive parsed views and ignores 0/null", () => {
  assert.equal(averageAvgViews(null), 0);
  assert.equal(averageAvgViews([]), 0);
  assert.equal(
    averageAvgViews([
      { avg_views: "800" },
      { avg_views: "1200" },
    ]),
    1000
  );
  assert.equal(
    averageAvgViews([
      { avg_views: "800" },
      { avg_views: "12k" },
      { avg_views: null },
      { avg_views: 0 },
      { avg_views: "2.5k" },
    ]),
    (800 + 12000 + 2500) / 3
  );
});
