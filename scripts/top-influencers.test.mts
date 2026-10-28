// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/top-influencers.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { hashAnalyticsIp, isBotUserAgent } from "../lib/analyticsIp.ts";
import {
  accumulateDemandScores,
  fetchAllAnalyticsEvents,
  mergeAcceptedApplicationDemand,
  type AnalyticsRow,
} from "../lib/computeTopInfluencers.ts";
import {
  applyIncumbentPenalty,
  blendTopScore,
  computeProfileCompletenessScore,
  computeResponseScore,
  isEligibleForTop10,
  normalizeScoresLog1p,
  TOP_CHANNEL_WEIGHT,
  TOP_COLLAB_WEIGHT,
  TOP_DEMAND_WEIGHT,
  TOP_PROFILE_WEIGHT,
  TOP_REACH_WEIGHT,
  TOP_RESPONSE_WEIGHT,
  type TopScoreInfluencer,
} from "../lib/topInfluencerScore.ts";

test("weight constants sum to 1", () => {
  const sum =
    TOP_DEMAND_WEIGHT +
    TOP_CHANNEL_WEIGHT +
    TOP_COLLAB_WEIGHT +
    TOP_REACH_WEIGHT +
    TOP_RESPONSE_WEIGHT +
    TOP_PROFILE_WEIGHT;
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test("accumulateDemandScores counts more than 1000 unique visitor events", () => {
  const events: AnalyticsRow[] = Array.from({ length: 1500 }, (_, i) => ({
    id: `e${i}`,
    influencer_id: "inf-1",
    event_type: "profile_click",
    visitor_id: `visitor-${i}`,
    created_at: "2026-01-15T12:00:00.000Z",
    metadata: {},
  }));
  const { scores, countedEvents } = accumulateDemandScores(events);
  assert.ok(countedEvents > 1000, `expected >1000 counted, got ${countedEvents}`);
  assert.equal(countedEvents, 1500);
  assert.equal(scores["inf-1"], 1500 * 3);
});

test("fetchAllAnalyticsEvents paginates past the 1000-row PostgREST cap", async () => {
  const total = 2500;
  const pageSize = 1000;
  const makeRow = (i: number): AnalyticsRow => ({
    id: `id-${String(i).padStart(5, "0")}`,
    influencer_id: "inf-a",
    event_type: "profile_view",
    brand_email: null,
    visitor_id: `v${i}`,
    ip_hash: null,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
    metadata: {},
  });

  const sb = {
    from() {
      const api: Record<string, unknown> = {
        select() {
          return api;
        },
        gte() {
          return api;
        },
        in() {
          return api;
        },
        order() {
          return api;
        },
        range(from: number, to: number) {
          const slice: AnalyticsRow[] = [];
          for (let i = from; i <= to && i < total; i++) slice.push(makeRow(i));
          return Promise.resolve({ data: slice, error: null });
        },
      };
      return api;
    },
  };

  const rows = await fetchAllAnalyticsEvents(
    sb as never,
    "2026-01-01T00:00:00.000Z",
    ["profile_view", "profile_click"],
    pageSize
  );
  assert.ok(rows.length > 1000, `expected >1000 rows, got ${rows.length}`);
  assert.equal(rows.length, total);
});

test("visitor_id counts once per influencer+type in the window", () => {
  const events: AnalyticsRow[] = [
    {
      influencer_id: "inf-1",
      event_type: "profile_click",
      visitor_id: "same-device",
      created_at: "2026-01-01T10:00:00.000Z",
    },
    {
      influencer_id: "inf-1",
      event_type: "profile_click",
      visitor_id: "same-device",
      created_at: "2026-01-20T10:00:00.000Z",
    },
    {
      influencer_id: "inf-1",
      event_type: "message_sent",
      visitor_id: "same-device",
      created_at: "2026-01-21T10:00:00.000Z",
    },
  ];
  const { scores, countedEvents } = accumulateDemandScores(events);
  assert.equal(countedEvents, 2);
  assert.equal(scores["inf-1"], 3 + 6);
});

test("ip_hash counts once per influencer+type per calendar day", () => {
  const events: AnalyticsRow[] = [
    {
      influencer_id: "inf-1",
      event_type: "profile_view",
      ip_hash: "abc",
      created_at: "2026-01-01T08:00:00.000Z",
    },
    {
      influencer_id: "inf-1",
      event_type: "profile_view",
      ip_hash: "abc",
      created_at: "2026-01-01T20:00:00.000Z",
    },
    {
      influencer_id: "inf-1",
      event_type: "profile_view",
      ip_hash: "abc",
      created_at: "2026-01-02T08:00:00.000Z",
    },
  ];
  const { scores, countedEvents } = accumulateDemandScores(events);
  assert.equal(countedEvents, 2);
  assert.ok(Math.abs(scores["inf-1"]! - 0.4) < 1e-9); // anon views 0.2 each
});

test("events without brand_email, visitor_id, and ip_hash are ignored", () => {
  const events: AnalyticsRow[] = [
    {
      id: "orphan-1",
      influencer_id: "inf-1",
      event_type: "profile_click",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "orphan-2",
      influencer_id: "inf-1",
      event_type: "profile_click",
      created_at: "2026-01-02T00:00:00.000Z",
    },
  ];
  const { scores, countedEvents } = accumulateDemandScores(events);
  assert.equal(countedEvents, 0);
  assert.equal(scores["inf-1"], undefined);
});

test("metadata.source top10 clicks are ignored in demand", () => {
  const events: AnalyticsRow[] = [
    {
      influencer_id: "inf-1",
      event_type: "profile_click",
      visitor_id: "v1",
      metadata: { source: "top10" },
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      influencer_id: "inf-1",
      event_type: "profile_click",
      visitor_id: "v2",
      metadata: { source: "directory" },
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ];
  const { scores, countedEvents } = accumulateDemandScores(events);
  assert.equal(countedEvents, 1);
  assert.equal(scores["inf-1"], 3);
});

test("brand profile_view weighs 1; anon weighs 0.2", () => {
  const events: AnalyticsRow[] = [
    {
      influencer_id: "inf-1",
      event_type: "profile_view",
      brand_email: "a@brand.com",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      influencer_id: "inf-1",
      event_type: "profile_view",
      visitor_id: "anon-1",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ];
  const { scores } = accumulateDemandScores(events);
  assert.ok(Math.abs(scores["inf-1"]! - 1.2) < 1e-9);
});

test("accepted campaign applications add unique brand demand", () => {
  const base = accumulateDemandScores([]).scores;
  const merged = mergeAcceptedApplicationDemand(base, [
    { influencer_id: "inf-1", brand_id: "brand-a" },
    { influencer_id: "inf-1", brand_id: "brand-a" },
    { influencer_id: "inf-1", brand_id: "brand-b" },
  ]);
  assert.equal(merged["inf-1"], 16);
});

test("normalizeScoresLog1p is not linear vs the leader", () => {
  const norm = normalizeScoresLog1p({ a: 100, b: 10, c: 0 });
  assert.equal(norm.a, 100);
  assert.ok(norm.b! > 10, "log mid-pack should score above linear 10");
  assert.equal(norm.c, 0);
});

test("isEligibleForTop10 requires avatar, bio, and a social username", () => {
  const base: TopScoreInfluencer = {
    id: "1",
    approved: true,
    avatar_url: "https://cdn/x.jpg",
    bio: "Hello",
    accounts: [{ platform: "instagram", username: "creator" }],
  };
  assert.equal(isEligibleForTop10(base), true);
  assert.equal(isEligibleForTop10({ ...base, avatar_url: "" }), false);
  assert.equal(isEligibleForTop10({ ...base, bio: "   " }), false);
  assert.equal(isEligibleForTop10({ ...base, accounts: [{ platform: "instagram", username: "" }] }), false);
  assert.equal(isEligibleForTop10({ ...base, accounts: [{ platform: "facebook", username: "x" }] }), false);
});

test("computeResponseScore is neutral 50 without data", () => {
  assert.equal(computeResponseScore({ id: "1" }), 50);
});

test("computeProfileCompletenessScore counts six signals", () => {
  const full: TopScoreInfluencer = {
    id: "1",
    avatar_url: "https://x",
    bio: "bio",
    accounts: [{ platform: "tiktok", username: "u" }],
    category: "Lifestyle",
    location: "Athens",
    min_rate: "100",
  };
  assert.equal(computeProfileCompletenessScore(full), 100);
  assert.equal(computeProfileCompletenessScore({ id: "1" }), 0);
});

test("blendTopScore object form uses new weights", () => {
  const score = blendTopScore({
    demand: 100,
    channel: 100,
    collab: 100,
    reach: 100,
    response: 100,
    profile: 100,
  });
  assert.equal(score, 100);
});

test("incumbent penalty removes 5%", () => {
  assert.equal(applyIncumbentPenalty(100, true), 95);
  assert.equal(applyIncumbentPenalty(100, false), 100);
});

test("isBotUserAgent catches common crawlers", () => {
  assert.equal(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  assert.equal(isBotUserAgent("facebookexternalhit/1.1"), true);
  assert.equal(isBotUserAgent("curl/8.0"), true);
  assert.equal(isBotUserAgent("HeadlessChrome/120"), true);
  assert.equal(isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)"), false);
});

test("hashAnalyticsIp is sha256(ip+salt) hex and never returns raw IP", () => {
  const salt = "test-salt";
  const ip = "203.0.113.9";
  const expected = createHash("sha256").update(`${ip}${salt}`, "utf8").digest("hex");
  assert.equal(hashAnalyticsIp(ip, salt), expected);
  assert.equal(hashAnalyticsIp(ip, salt)?.includes(ip), false);
  assert.equal(hashAnalyticsIp(ip, ""), null);
  assert.equal(hashAnalyticsIp("", salt), null);
});
