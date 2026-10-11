// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/engagement-flags.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  applyErFlags,
  creatorHasHardErOnMainAccount,
  displayErFlag,
  parseErPercent,
  recomputeStoredAccount,
  type ErCheckInput,
} from "../lib/engagementFlags.ts";
import { ensureSuspiciousErInNegatives, type AuditResult } from "../lib/auditGemini.ts";
import { trustChipsFromAccounts } from "../lib/trustSignals.ts";
import { applyTopTrustPenalty, trustedErPercent, type TopScoreInfluencer } from "../lib/topInfluencerScore.ts";

function postsOf(raw: number | string | null | undefined): number {
  const n = Number(String(raw ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Previous detector: flat Instagram ceilings, every flag was Ύποπτο, stored true won. */
function legacyHard(input: ErCheckInput): boolean {
  if (input.er_suspicious === true) return true;
  const erStr = String(input.engagement_rate ?? "").trim();
  if (!erStr || erStr.toUpperCase() === "N/A" || erStr === "-") return false;
  if (input.suspected_fake_penalty || input.er_flag_reason === "quality_adjusted") return true;
  if (input.engagement_hidden || input.er_flag_reason === "estimated" || erStr.startsWith("~")) return true;
  const posts = postsOf(input.posts_count);
  if (posts > 0 && posts < 5) return true;
  const er = parseErPercent(erStr);
  if (er == null) return false;
  const platform = String(input.platform || "").toLowerCase();
  const views = postsOf(input.avg_views);
  const likes = postsOf(input.avg_likes);
  if (platform === "tiktok" || platform === "youtube") {
    const looksViewsBased = views > 0 && likes > 0 && likes <= views * 1.25 && er < 40;
    if (looksViewsBased) return er >= 18 || (er >= 12 && posts > 0 && posts < 12);
    return er >= 80 || (er >= 40 && posts > 0 && posts < 12);
  }
  if (er >= 25) return true;
  if (er >= 15 && posts > 0 && posts < 12) return true;
  return false;
}

type Bucket = "lose" | "gain" | "keep" | "clear";

const scenarios: { name: string; legacy: ErCheckInput; fresh: ErCheckInput; bucket: Bucket }[] = [
  {
    name: "instagram 2k followers, 16%, 8 posts",
    legacy: { engagement_rate: "16%", posts_count: 8, avg_likes: 320 },
    fresh: { platform: "instagram", username: "a", followers: 2000, engagement_rate: "16%", posts_count: 8, avg_likes: 320 },
    bucket: "lose",
  },
  {
    name: "instagram 800 followers, 27.5%, 30 posts",
    legacy: { engagement_rate: "27.5%", posts_count: 30, avg_likes: 220 },
    fresh: { platform: "instagram", username: "a", followers: 800, engagement_rate: "27.5%", posts_count: 30, avg_likes: 220 },
    bucket: "lose",
  },
  {
    name: "tiktok 5k followers, 30% follower-based, 20 posts, no views",
    legacy: { engagement_rate: "30%", posts_count: 20, avg_likes: 1500 },
    fresh: { platform: "tiktok", username: "a", followers: 5000, engagement_rate: "30%", posts_count: 20, avg_likes: 1500 },
    bucket: "lose",
  },
  {
    name: "hidden likes ~3.1%",
    legacy: { engagement_rate: "~3.1%", posts_count: 20, engagement_hidden: true },
    fresh: { platform: "instagram", username: "a", followers: 12000, engagement_rate: "~3.1%", posts_count: 20, engagement_hidden: true },
    bucket: "lose",
  },
  {
    name: "3 posts at 4%",
    legacy: { engagement_rate: "4%", posts_count: 3 },
    fresh: { platform: "instagram", username: "a", followers: 8000, engagement_rate: "4%", posts_count: 3 },
    bucket: "lose",
  },
  {
    name: "penalty boolean with no magnitude",
    legacy: { engagement_rate: "6%", posts_count: 20, suspected_fake_penalty: true },
    fresh: { platform: "instagram", username: "a", followers: 20000, engagement_rate: "6%", posts_count: 20, suspected_fake_penalty: true },
    bucket: "lose",
  },
  {
    name: "stale er_suspicious on a healthy rate",
    legacy: { engagement_rate: "4%", posts_count: 20, er_suspicious: true, er_flag_reason: "inflated" },
    fresh: { platform: "instagram", username: "a", followers: 15000, engagement_rate: "4%", posts_count: 20, er_suspicious: true, er_flag_reason: "inflated" },
    bucket: "lose",
  },
  {
    name: "instagram under 5k at 45% with a full sample",
    legacy: { engagement_rate: "45%", posts_count: 20 },
    fresh: { platform: "instagram", username: "a", followers: 2000, engagement_rate: "45%", posts_count: 20 },
    bucket: "lose",
  },
  {
    name: "instagram 200k at 18% with a full sample",
    legacy: { engagement_rate: "18%", posts_count: 20 },
    fresh: { platform: "instagram", username: "a", followers: 200000, engagement_rate: "18%", posts_count: 20 },
    bucket: "gain",
  },
  {
    name: "tiktok views-based 20% when platform and views are passed",
    legacy: { engagement_rate: "20%", posts_count: 20, avg_likes: 2000 },
    fresh: {
      platform: "tiktok",
      username: "a",
      followers: 50000,
      engagement_rate: "20%",
      posts_count: 20,
      avg_likes: 2000,
      avg_views: 100000,
    },
    bucket: "gain",
  },
  {
    name: "measured quality cut 12% to 4%",
    legacy: { engagement_rate: "4%", posts_count: 20, suspected_fake_penalty: true, engagement_rate_raw: "12%" },
    fresh: {
      platform: "instagram",
      username: "a",
      followers: 40000,
      engagement_rate: "4%",
      posts_count: 20,
      suspected_fake_penalty: true,
      engagement_rate_raw: "12%",
    },
    bucket: "keep",
  },
  {
    name: "instagram under 5k at 55%",
    legacy: { engagement_rate: "55%", posts_count: 20 },
    fresh: { platform: "instagram", username: "a", followers: 2000, engagement_rate: "55%", posts_count: 20 },
    bucket: "keep",
  },
  {
    name: "zero posts at 4%",
    legacy: { engagement_rate: "4%", posts_count: 0 },
    fresh: { platform: "instagram", username: "a", followers: 2000, engagement_rate: "4%", posts_count: 0 },
    bucket: "clear",
  },
];

function bucketOf(wasHard: boolean, isHard: boolean): Bucket {
  if (wasHard && !isHard) return "lose";
  if (!wasHard && isHard) return "gain";
  if (wasHard && isHard) return "keep";
  return "clear";
}

test("analysis scenarios lose, gain, or keep Ύποπτο as documented", () => {
  const counts = { lose: 0, gain: 0, keep: 0, clear: 0 };
  for (const scenario of scenarios) {
    const wasHard = legacyHard(scenario.legacy);
    const next = displayErFlag(scenario.fresh);
    const isHard = next?.suspicious === true;
    const bucket = bucketOf(wasHard, isHard);
    assert.equal(bucket, scenario.bucket, scenario.name);
    counts[bucket] += 1;
  }
  assert.deepEqual(counts, { lose: 8, gain: 2, keep: 2, clear: 1 });
});

test("small instagram accounts are not suspicious at 10–20%, and 55% still is", () => {
  const mild = displayErFlag({
    platform: "instagram",
    followers: "2k",
    engagement_rate: "16%",
    posts_count: 8,
    avg_likes: 320,
  });
  assert.equal(mild, null);

  const mid = displayErFlag({
    platform: "instagram",
    followers: 800,
    engagement_rate: "27.5%",
    posts_count: 30,
  });
  assert.equal(mid, null);

  const extreme = displayErFlag({
    platform: "instagram",
    followers: 800,
    engagement_rate: "55%",
    posts_count: 30,
  });
  assert.equal(extreme?.reason, "inflated");
  assert.equal(extreme?.suspicious, true);

  const large = displayErFlag({
    platform: "instagram",
    followers: "200k",
    engagement_rate: "18%",
    posts_count: 20,
  });
  assert.equal(large?.suspicious, true);
});

test("tiktok uses its own ceilings only when platform and views are passed", () => {
  const metrics = {
    followers: "5000",
    engagement_rate: "50%",
    avg_likes: "2500",
    posts_count: 20,
  };
  const asTiktok = applyErFlags(metrics, "tiktok");
  const asInstagram = applyErFlags(metrics, "instagram");
  assert.equal(asTiktok.er_suspicious, false);
  assert.equal(asTiktok.er_flag_reason, undefined);
  assert.equal(asInstagram.er_suspicious, true);
  assert.equal(asInstagram.er_flag_reason, "inflated");

  const thirty = displayErFlag({
    platform: "tiktok",
    followers: 5000,
    engagement_rate: "30%",
    posts_count: 20,
    avg_likes: 1500,
  });
  assert.equal(thirty, null);

  const views = displayErFlag({
    platform: "tiktok",
    followers: 50000,
    engagement_rate: "20%",
    posts_count: 20,
    avg_likes: 2000,
    avg_views: 100000,
  });
  assert.equal(views?.reason, "inflated");
  assert.equal(views?.suspicious, true);
});

test("estimates and short samples are labeled for brands and are not Ύποπτο", () => {
  const estimate = displayErFlag({
    platform: "instagram",
    followers: 12000,
    engagement_rate: "~3.1%",
    posts_count: 20,
  });
  assert.equal(estimate?.reason, "estimated");
  assert.equal(estimate?.suspicious, false);
  assert.equal(estimate?.labelEl, "Εκτίμηση");

  const thin = displayErFlag({
    platform: "instagram",
    followers: 8000,
    engagement_rate: "4%",
    posts_count: 3,
  });
  assert.equal(thin?.reason, "low_sample");
  assert.equal(thin?.suspicious, false);
  assert.equal(thin?.labelEl, "Λίγα δεδομένα");

  const none = displayErFlag({
    platform: "instagram",
    followers: 8000,
    engagement_rate: "4%",
    posts_count: 0,
  });
  assert.equal(none, null);

  const extremeThin = displayErFlag({
    platform: "instagram",
    followers: 800,
    engagement_rate: "80%",
    posts_count: 3,
  });
  assert.equal(extremeThin?.reason, "low_sample");
  assert.equal(extremeThin?.suspicious, false);

  const chips = trustChipsFromAccounts([
    { platform: "instagram", username: "est", followers: 12000, engagement_rate: "~3.1%", posts_count: 20 },
    { platform: "tiktok", username: "thin", followers: 4000, engagement_rate: "4%", posts_count: 3 },
  ]);
  const erChip = chips.find((chip) => chip.kind === "er");
  assert.ok(erChip);
  assert.equal(erChip?.labelEl, "Λίγα δεδομένα");
  assert.notEqual(erChip?.labelEl, "Ύποπτο ER");

  const estimateOnly = trustChipsFromAccounts([
    { platform: "instagram", username: "est", followers: 12000, engagement_rate: "~3.1%", posts_count: 20 },
  ]);
  assert.equal(estimateOnly[0]?.labelEl, "Εκτίμηση");
  assert.equal(estimateOnly[0]?.labelEn, "Estimate");
});

test("an unmeasured penalty is a note, and a large drop is Ύποπτο", () => {
  const note = displayErFlag({
    platform: "instagram",
    followers: 20000,
    engagement_rate: "6%",
    posts_count: 20,
    suspected_fake_penalty: true,
  });
  assert.equal(note?.reason, "quality_note");
  assert.equal(note?.suspicious, false);
  assert.equal(note?.labelEl, "Σημείωση ER");

  const storedNote = displayErFlag({
    platform: "instagram",
    followers: 20000,
    engagement_rate: "6%",
    posts_count: 20,
    er_flag_reason: "quality_adjusted",
    er_suspicious: true,
  });
  assert.equal(storedNote?.suspicious, false);
  assert.equal(storedNote?.reason, "quality_note");

  const cut = displayErFlag({
    platform: "instagram",
    followers: 40000,
    engagement_rate: "4%",
    posts_count: 20,
    engagement_rate_raw: "12%",
    suspected_fake_penalty: true,
  });
  assert.equal(cut?.reason, "quality_adjusted");
  assert.equal(cut?.suspicious, true);

  const percent = displayErFlag({
    platform: "instagram",
    followers: 40000,
    engagement_rate: "4%",
    posts_count: 20,
    fake_follower_percent: 25,
  });
  assert.equal(percent?.suspicious, true);
  assert.equal(percent?.reason, "quality_adjusted");
});

test("stale er_suspicious does not override a fresh computation", () => {
  const fresh = displayErFlag({
    platform: "instagram",
    followers: 15000,
    engagement_rate: "4%",
    posts_count: 20,
    er_suspicious: true,
    er_flag_reason: "inflated",
  });
  assert.equal(fresh, null);

  const stored = recomputeStoredAccount({
    platform: "instagram",
    username: "a",
    followers: "15k",
    engagement_rate: "4%",
    posts_count: 20,
    er_suspicious: true,
    er_flag_reason: "inflated",
  });
  assert.equal(stored.er_suspicious, false);
  assert.equal(stored.er_flag_reason, null);
});

function audit(brandSafe = true): AuditResult {
  return {
    scoreBreakdown: ["a", "b", "c", "d"],
    brandSafe,
    negatives: [],
    negatives_en: [],
  };
}

test("Brand Safe and the Top 10 penalty follow only a hard flag on the main account", () => {
  const estimate = [
    {
      platform: "instagram",
      username: "main",
      followers: 12000,
      engagement_rate: "~3.1%",
      posts_count: 20,
    },
  ];
  const estimatedAudit = ensureSuspiciousErInNegatives(estimate, audit(true));
  assert.equal(estimatedAudit.brandSafe, true);
  assert.deepEqual(estimatedAudit.negatives, []);
  assert.equal(creatorHasHardErOnMainAccount(estimate), false);
  assert.equal(applyTopTrustPenalty(80, { id: "est", accounts: estimate }), 80);

  const thin = [
    { platform: "instagram", username: "main", followers: 8000, engagement_rate: "4%", posts_count: 3 },
  ];
  assert.equal(ensureSuspiciousErInNegatives(thin, audit(true)).brandSafe, true);
  assert.equal(applyTopTrustPenalty(80, { id: "thin", accounts: thin }), 80);

  const hardMain = [
    { platform: "instagram", username: "main", followers: 2000, engagement_rate: "55%", posts_count: 20 },
  ];
  const blocked = ensureSuspiciousErInNegatives(hardMain, audit(true));
  assert.equal(blocked.brandSafe, false);
  assert.equal(blocked.negatives?.length, 1);
  assert.equal(applyTopTrustPenalty(100, { id: "hard", accounts: hardMain }), 35);

  const secondary = [
    { platform: "instagram", username: "main", followers: 50000, engagement_rate: "4%", posts_count: 20, avg_likes: 2000 },
    { platform: "tiktok", username: "side", followers: 1000, engagement_rate: "90%", posts_count: 20, avg_likes: 900 },
  ];
  const stillSafe = ensureSuspiciousErInNegatives(secondary, audit(true));
  assert.equal(stillSafe.brandSafe, true);
  assert.deepEqual(stillSafe.negatives, []);
  assert.equal(creatorHasHardErOnMainAccount(secondary), false);
  assert.equal(applyTopTrustPenalty(80, { id: "side", accounts: secondary }), 80);
  const chip = trustChipsFromAccounts(secondary).find((item) => item.kind === "er");
  assert.equal(chip?.labelEl, "Ύποπτο ER");

  const measured = [
    {
      platform: "instagram",
      username: "main",
      followers: 40000,
      engagement_rate: "4%",
      posts_count: 20,
      engagement_rate_raw: "12%",
      suspected_fake_penalty: true,
    },
  ];
  assert.equal(ensureSuspiciousErInNegatives(measured, audit(true)).brandSafe, false);
  assert.equal(applyTopTrustPenalty(100, { id: "cut", accounts: measured }), 35);

  const stale: TopScoreInfluencer = {
    id: "stale",
    accounts: [
      {
        platform: "instagram",
        username: "main",
        followers: 15000,
        engagement_rate: "4%",
        posts_count: 20,
        er_suspicious: true,
        er_flag_reason: "inflated",
      },
    ],
  };
  assert.equal(applyTopTrustPenalty(80, stale), 80);
  assert.equal(trustedErPercent(stale.accounts![0]), 4);

  const privateOnly: TopScoreInfluencer = {
    id: "private",
    accounts: [
      {
        platform: "instagram",
        username: "main",
        followers: 15000,
        engagement_rate: "4%",
        posts_count: 20,
        is_private: true,
      },
    ],
  };
  assert.equal(applyTopTrustPenalty(80, privateOnly), 80);
});

test("hard flags still dampen the rate used inside the channel score", () => {
  const mild = trustedErPercent({
    platform: "instagram",
    followers: 2000,
    engagement_rate: "16%",
    posts_count: 8,
  });
  assert.equal(mild, 12);

  const extreme = trustedErPercent({
    platform: "instagram",
    followers: 2000,
    engagement_rate: "55%",
    posts_count: 20,
  });
  assert.equal(extreme, 4);
});
