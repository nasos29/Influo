import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateInsightsRulesAgainstScrape,
  insightsMetricsMismatchReason,
  runLenientInsightsCheck,
} from "../lib/lenientInsightsCheck.ts";

test("insights follower mismatch >20%", () => {
  const reason = insightsMetricsMismatchReason(
    { platform: "instagram", username: "foo", followers: 1000, avgLikes: 40 },
    { platform: "instagram", username: "foo", followers: 700, avg_likes: 40 }
  );
  assert.ok(reason && /Followers differ/.test(reason));
});

test("insights likes > followers", () => {
  const reason = insightsMetricsMismatchReason(
    { platform: "tiktok", username: "bar", followers: 500, avgLikes: 10 },
    { platform: "tiktok", username: "bar", followers: 500, avg_likes: 600 }
  );
  assert.ok(reason && /Likes/.test(reason));
});

test("insights handle mismatch", () => {
  const reason = insightsMetricsMismatchReason(
    { platform: "instagram", username: "real", followers: 1000, avgLikes: 10 },
    { platform: "instagram", username: "wrong", followers: 1000, avg_likes: 10 }
  );
  assert.ok(reason && /Handle mismatch/.test(reason));
});

test("insights rules pass when within tolerance", () => {
  const out = evaluateInsightsRulesAgainstScrape(
    [{ platform: "instagram", username: "foo", followers: "1000", avg_likes: "50", ok: true }],
    [{ platform: "instagram", username: "foo", followers: 950, avg_likes: 50 }]
  );
  assert.equal(out.passed, true);
});

test("empty insights_urls skips Gemini", async () => {
  const out = await runLenientInsightsCheck({
    insights_urls: [],
    scrapedAccounts: [{ platform: "instagram", username: "a", followers: "100", ok: true }],
  });
  assert.equal(out.analytics_verified, false);
  assert.equal(out.passed, false);
  assert.equal(out.reason, "no_insights");
});