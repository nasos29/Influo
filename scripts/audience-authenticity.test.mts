// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/audience-authenticity.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  computeAudienceAuthenticity,
  matchesAuthenticityListFilter,
  parseAuthenticityListFilter,
} from "../lib/audienceAuthenticity.ts";

test("parseAuthenticityListFilter", () => {
  assert.equal(parseAuthenticityListFilter("suspicious"), "suspicious");
  assert.equal(parseAuthenticityListFilter("REVIEW"), "review");
  assert.equal(parseAuthenticityListFilter(""), "all");
});

test("healthy instagram mid-tier lands clean", () => {
  const r = computeAudienceAuthenticity({
    accounts: [
      {
        platform: "instagram",
        username: "good",
        followers: 25000,
        engagement_rate: "2.4%",
        avg_likes: 600,
        avg_views: 12000,
      },
    ],
  });
  assert.equal(r.status, "clean");
  assert.ok(r.score != null && r.score >= 70);
});

test("low ER mid instagram is at least review", () => {
  const r = computeAudienceAuthenticity({
    accounts: [
      {
        platform: "instagram",
        username: "dead",
        followers: 25000,
        engagement_rate: "0.3%",
        avg_likes: 75,
        avg_views: 500,
      },
    ],
  });
  assert.ok(r.status === "review" || r.status === "suspicious");
  assert.ok(r.score != null && r.score < 70);
  assert.match(r.reasons[0]?.el || "", /engagement/i);
});

test("very low ER and views is suspicious", () => {
  const r = computeAudienceAuthenticity({
    accounts: [
      {
        platform: "instagram",
        username: "bot",
        followers: 80000,
        engagement_rate: "0.05%",
        avg_likes: 40,
        avg_views: 200,
      },
    ],
  });
  assert.equal(r.status, "suspicious");
  assert.ok(r.score != null && r.score < 40);
});

test("tiny account is insufficient", () => {
  const r = computeAudienceAuthenticity({
    accounts: [
      { platform: "instagram", username: "tiny", followers: 200, engagement_rate: "5%", avg_likes: 10 },
    ],
  });
  assert.equal(r.status, "insufficient");
  assert.equal(r.score, null);
});

test("private-only is insufficient", () => {
  const r = computeAudienceAuthenticity({
    accounts: [{ platform: "instagram", username: "x", followers: 50000, is_private: true }],
  });
  assert.equal(r.status, "insufficient");
});

test("estimated ER does not alone flag", () => {
  const r = computeAudienceAuthenticity({
    accounts: [
      {
        platform: "instagram",
        username: "hid",
        followers: 12000,
        engagement_rate: "~1.5%",
        engagement_hidden: true,
        avg_views: 15000,
      },
    ],
  });
  assert.notEqual(r.status, "suspicious");
});

test("tiktok mid with decent views stays clean", () => {
  const r = computeAudienceAuthenticity({
    accounts: [
      {
        platform: "tiktok",
        username: "tt",
        followers: 30000,
        engagement_rate: "4%",
        avg_views: 250000,
      },
    ],
  });
  assert.equal(r.status, "clean");
});

test("follower jump adds review or worse", () => {
  const r = computeAudienceAuthenticity({
    accounts: [
      {
        platform: "instagram",
        username: "jump",
        followers: 30000,
        engagement_rate: "2%",
        avg_views: 20000,
      },
    ],
    snapshots: [
      { snapshot_at: "2025-11-01", total_followers: 50000, accounts: [{ platform: "instagram", username: "jump", followers: 50000 }] },
      { snapshot_at: "2025-10-01", total_followers: 20000, accounts: [{ platform: "instagram", username: "jump", followers: 20000 }] },
    ],
  });
  assert.ok(["review", "suspicious"].includes(r.status));
  assert.ok(r.reasons.some((x) => x.el.includes("άλμα")));
});

test("matchesAuthenticityListFilter", () => {
  const bad = computeAudienceAuthenticity({
    accounts: [{ platform: "instagram", username: "b", followers: 60000, engagement_rate: "0.05%", avg_views: 100 }],
  });
  assert.equal(matchesAuthenticityListFilter(bad, "all"), true);
  assert.equal(matchesAuthenticityListFilter(bad, "suspicious"), bad.status === "suspicious");
  assert.equal(matchesAuthenticityListFilter(bad, "review"), bad.status === "review");
});