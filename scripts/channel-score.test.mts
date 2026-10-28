// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/channel-score.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  AXIS_LABELS,
  buildChannelScore,
  erBandThresholds,
  excellentErThreshold,
} from "../lib/channelScore.ts";

function axis(score: ReturnType<typeof buildChannelScore>, id: string): number {
  return score.axes.find((a) => a.id === id)?.score ?? -1;
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
  // Neutral response 0.4 + neutral completion 0.75 = 1.15
  assert.equal(empty.coopPotential, 1.2);
  assert.ok(empty.coopPotential < 2);
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
});

test("axis labels renamed for portfolio and verification", () => {
  assert.equal(AXIS_LABELS.creationPublish.el, "Δείγματα δουλειάς");
  assert.equal(AXIS_LABELS.creationPublish.en, "Portfolio");
  assert.equal(AXIS_LABELS.audienceCredibility.el, "Πληρότητα & επαλήθευση");
  assert.equal(AXIS_LABELS.audienceCredibility.en, "Verification & completeness");
});
