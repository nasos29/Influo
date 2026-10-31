// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/channel-score.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  AXIS_LABELS,
  buildChannelScore,
  erBandThresholds,
  excellentErThreshold,
  scoreFollowersGrowth,
} from "../lib/channelScore.ts";

function axis(score: ReturnType<typeof buildChannelScore>, id: string): number | null {
  const found = score.axes.find((a) => a.id === id);
  return found ? found.score : -1;
}

test("excellent ER thresholds scale with follower size", () => {
  assert.equal(excellentErThreshold(5_000), 8);
  assert.equal(excellentErThreshold(50_000), 5);
  assert.equal(excellentErThreshold(200_000), 3);
  assert.equal(excellentErThreshold(800_000), 2);
  assert.deepEqual(erBandThresholds(5_000), { excellent: 8, good: 4.8, average: 2.4 });
});

test("engagement score uses size-scaled bands", () => {
  const nano = buildChannelScore({
    followersTotal: 5_000,
    contentCount: 0,
    platformCount: 1,
    engagementRate: "8%",
  });
  const nanoMid = buildChannelScore({
    followersTotal: 5_000,
    contentCount: 0,
    platformCount: 1,
    engagementRate: "5%",
  });
  const mega = buildChannelScore({
    followersTotal: 800_000,
    contentCount: 0,
    platformCount: 1,
    engagementRate: "2%",
  });
  const megaLow = buildChannelScore({
    followersTotal: 800_000,
    contentCount: 0,
    platformCount: 1,
    engagementRate: "0.5%",
  });
  assert.equal(axis(nano, "engagementRate"), 4.8);
  assert.equal(axis(nanoMid, "engagementRate"), 4.0);
  assert.equal(axis(mega, "engagementRate"), 4.8);
  assert.equal(axis(megaLow, "engagementRate"), 2.2);
});

test("hard ER flag keeps engagement neutral at 2.5 with no bonus", () => {
  const flagged = buildChannelScore({
    followersTotal: 20_000,
    contentCount: 0,
    platformCount: 1,
    engagementRate: "25%",
    erFlagged: true,
  });
  const clean = buildChannelScore({
    followersTotal: 20_000,
    contentCount: 0,
    platformCount: 1,
    engagementRate: "25%",
    erFlagged: false,
  });
  assert.equal(axis(flagged, "engagementRate"), 2.5);
  assert.ok(axis(clean, "engagementRate") > 2.5);
  // Flagged quality is penalized, not boosted by ER.
  assert.ok(axis(flagged, "channelQuality") < axis(clean, "channelQuality"));
});

test("collaboration readiness can reach 10", () => {
  const full = buildChannelScore({
    followersTotal: 40_000,
    contentCount: 3,
    platformCount: 2,
    verified: true,
    brandSafe: true,
    hasAudience: true,
    reviewCount: 4,
    avgRating: 4.8,
    completionRate: 100,
    avgResponseHours: 4,
    minRate: "150",
    rateCard: { story: "80", post: "200" },
    hasAvatar: true,
    hasBio: true,
  });
  assert.equal(full.coopPotential, 10);
});

test("collaboration readiness is low when profile is empty", () => {
  const empty = buildChannelScore({
    followersTotal: 0,
    contentCount: 0,
    platformCount: 0,
    reviewCount: 0,
  });
  // Neutral response 1.0 + completion 0.75 + reviews 0.75 = 2.5
  assert.equal(empty.coopPotential, 2.5);
  assert.ok(empty.coopPotential <= 3);
});

test("collaboration readiness: strong reach without reviews/response still ≥ 6", () => {
  const strong = buildChannelScore({
    followersTotal: 200_000,
    contentCount: 5,
    platformCount: 1,
    verified: false,
    hasAvatar: true,
    hasBio: true,
    reviewCount: 0,
    avgResponseHours: null,
    minRate: "200",
    rateCard: { story: "100", post: "300" },
    erFlagged: false,
  });
  assert.ok(strong.coopPotential >= 6);

  const blank = buildChannelScore({
    followersTotal: 0,
    contentCount: 0,
    platformCount: 0,
  });
  assert.ok(blank.coopPotential <= 3);
});

test("reach bonus skipped when ER flagged", () => {
  const clean = buildChannelScore({
    followersTotal: 200_000,
    contentCount: 0,
    platformCount: 1,
    erFlagged: false,
  });
  const flagged = buildChannelScore({
    followersTotal: 200_000,
    contentCount: 0,
    platformCount: 1,
    erFlagged: true,
  });
  assert.ok(clean.coopPotential > flagged.coopPotential);
});

test("integration shows From (no ×2.2) when only min_rate exists", () => {
  const onlyMin = buildChannelScore({
    followersTotal: 10_000,
    contentCount: 0,
    platformCount: 1,
    minRate: "100",
  });
  assert.equal(onlyMin.integrationFrom, 100);
  assert.equal(onlyMin.integrationTo, null);
  assert.equal("integrationIsEstimate" in onlyMin, false);

  const withCard = buildChannelScore({
    followersTotal: 10_000,
    contentCount: 0,
    platformCount: 1,
    minRate: "100",
    rateCard: { story: "80", post: "250" },
  });
  assert.equal(withCard.integrationFrom, 80);
  assert.equal(withCard.integrationTo, 250);

  const withExtrasOnly = buildChannelScore({
    followersTotal: 10_000,
    contentCount: 0,
    platformCount: 1,
    minRate: "100",
    rateCard: { story: "80", post: "250", usage_rights_ads: "15", link_in_bio: "10", event_visit: "400" },
  });
  assert.equal(withExtrasOnly.integrationFrom, 80);
  assert.equal(withExtrasOnly.integrationTo, 250);

  const withUgc = buildChannelScore({
    followersTotal: 10_000,
    contentCount: 0,
    platformCount: 1,
    minRate: "100",
    rateCard: { story: "80", ugc_video: "60", carousel: "300" },
  });
  assert.equal(withUgc.integrationFrom, 60);
  assert.equal(withUgc.integrationTo, 300);
});

test("axis labels for verification; no creationPublish axis", () => {
  assert.equal(AXIS_LABELS.audienceCredibility.el, "Πληρότητα & επαλήθευση");
  assert.equal(AXIS_LABELS.audienceCredibility.en, "Verification & completeness");
  assert.equal("creationPublish" in AXIS_LABELS, false);
  const score = buildChannelScore({
    followersTotal: 5_000,
    contentCount: 10,
    platformCount: 1,
  });
  assert.equal(score.axes.some((a) => a.id === "creationPublish"), false);
  assert.equal(score.axes.length, 4);
});

test("contentCount >= 3 still adds +0.5 to collaboration readiness", () => {
  const without = buildChannelScore({
    followersTotal: 0,
    contentCount: 0,
    platformCount: 0,
  });
  const withSamples = buildChannelScore({
    followersTotal: 0,
    contentCount: 3,
    platformCount: 0,
  });
  assert.equal(withSamples.coopPotential, round1(without.coopPotential + 0.5));
});

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

test("scoreAudience uses avatar/bio/age more than rare verified", () => {
  const bare = buildChannelScore({
    followersTotal: 5_000,
    contentCount: 0,
    platformCount: 1,
  });
  const filled = buildChannelScore({
    followersTotal: 5_000,
    contentCount: 0,
    platformCount: 1,
    hasAvatar: true,
    hasBio: true,
    hasAudience: true,
    brandSafe: true,
    reviewCount: 1,
    verified: true,
  });
  assert.equal(axis(bare, "audienceCredibility"), 1.5);
  assert.equal(axis(filled, "audienceCredibility"), 5);
});

test("growthPct null excludes followersGrowth from influoScore", () => {
  assert.equal(scoreFollowersGrowth(null), null);
  const missing = buildChannelScore({
    followersTotal: 5_000,
    contentCount: 0,
    platformCount: 1,
    growthPct: null,
  });
  assert.equal(axis(missing, "followersGrowth"), null);
  const scoredAxes = missing.axes.filter((a) => a.score != null);
  assert.equal(scoredAxes.length, 3);
  const expected =
    Math.round(
      (scoredAxes.reduce((sum, a) => sum + (a.score as number), 0) / scoredAxes.length) * 10
    ) / 10;
  assert.equal(missing.influoScore, expected);

  const withGrowth = buildChannelScore({
    followersTotal: 5_000,
    contentCount: 0,
    platformCount: 1,
    growthPct: 2,
  });
  assert.ok(axis(withGrowth, "followersGrowth") != null);
  assert.equal("costPer1k" in missing, false);
});

test("buildChannelScore uses weighted ER across platforms", () => {
  const weighted = buildChannelScore({
    followersTotal: 4000,
    followersByPlatform: { instagram: 1000, tiktok: 3000 },
    engagementRate: { instagram: "10%", tiktok: "2%" },
    contentCount: 0,
    platformCount: 2,
  });
  assert.equal(weighted.engagementPercent, 4);
});
