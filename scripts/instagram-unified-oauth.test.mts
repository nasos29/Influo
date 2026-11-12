import assert from "node:assert/strict";
import test from "node:test";

process.env.SOCIAL_TOKEN_ENCRYPTION_KEY =
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY ||
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.SOCIAL_OAUTH_STATE_SECRET =
  process.env.SOCIAL_OAUTH_STATE_SECRET || "test-state-secret-at-least-32-chars!!";

const { encryptSecret, decryptSecret, signOAuthState, verifyOAuthState } = await import(
  "../lib/social/tokenCrypto.ts"
);
const {
  buildUnifiedAuthorizeUrl,
  redactSecrets,
  META_GRAPH_VERSION,
  buildDayInsightsRequestSpecs,
  buildDemographicsInsightsParams,
  aggregateDayInsightsGroups,
} = await import("../lib/social/instagramUnified.ts");

test("encrypt/decrypt roundtrip", () => {
  const plain = "SUAT_test_token_value";
  const enc = encryptSecret(plain);
  assert.notEqual(enc, plain);
  assert.equal(decryptSecret(enc), plain);
});

test("oauth state signs and verifies", () => {
  const state = signOAuthState({ influencerId: "inf-1", uid: "user-1" }, 60);
  const parsed = verifyOAuthState(state);
  assert.ok(parsed);
  assert.equal(parsed!.influencerId, "inf-1");
  assert.equal(parsed!.uid, "user-1");
  assert.ok(parsed!.nonce);
});

test("oauth state rejects tampering", () => {
  const state = signOAuthState({ influencerId: "inf-1", uid: "user-1" }, 60);
  assert.equal(verifyOAuthState(state + "x"), null);
});

test("oauth state rejects expired", () => {
  const state = signOAuthState({ influencerId: "inf-1", uid: "user-1" }, 60);
  const parsed = verifyOAuthState(state);
  assert.ok(parsed);
  assert.equal(verifyOAuthState(state, { nowSec: parsed!.exp + 1 }), null);
});

test("oauth state rejects invalid / missing parts", () => {
  assert.equal(verifyOAuthState(""), null);
  assert.equal(verifyOAuthState("not-a-state"), null);
  assert.equal(verifyOAuthState("abc.def"), null);
});

test("authorize url uses config_id not scope", () => {
  process.env.META_APP_ID = "1085701814491082";
  process.env.META_IG_CONFIG_ID = "1647951953401160";
  process.env.META_IG_REDIRECT_URI = "https://www.influo.gr/api/social/instagram/callback";
  const url = buildUnifiedAuthorizeUrl("abc.state");
  assert.match(url, /facebook\.com\/.*\/dialog\/oauth/);
  assert.match(url, /config_id=1647951953401160/);
  assert.match(url, /client_id=1085701814491082/);
  assert.doesNotMatch(url, /[?&]scope=/);
  assert.ok(META_GRAPH_VERSION);
});

test("redactSecrets strips tokens", () => {
  const s = redactSecrets("https://x?access_token=SECRET&code=AUTHCODE&client_secret=APPSEC");
  assert.equal(s.includes("SECRET"), false);
  assert.equal(s.includes("AUTHCODE"), false);
  assert.equal(s.includes("APPSEC"), false);
});

test("day insights request specs split reach vs totals", () => {
  const specs = buildDayInsightsRequestSpecs();
  assert.equal(specs.length, 2);

  const reach = specs.find((s) => s.kind === "reach_time_series");
  assert.ok(reach);
  assert.equal(reach!.metrics, "reach");
  assert.equal(reach!.params.metric, "reach");
  assert.equal(reach!.params.period, "day");
  assert.equal(reach!.metricType, null);
  assert.equal(reach!.representation, "time_series");
  assert.equal("metric_type" in reach!.params, false);

  const totals = specs.find((s) => s.kind === "engagement_totals");
  assert.ok(totals);
  assert.equal(totals!.metrics, "views,accounts_engaged");
  assert.equal(totals!.params.metric_type, "total_value");
  assert.equal(totals!.representation, "total_value");
  assert.doesNotMatch(totals!.metrics, /profile_views/);
  assert.equal(
    specs.some((s) => s.metrics.includes("profile_views") || s.params.metric?.includes("profile_views")),
    false
  );
});

test("demographics insights params remain unchanged", () => {
  const params = buildDemographicsInsightsParams("age");
  assert.deepEqual(params, {
    metric: "follower_demographics",
    period: "lifetime",
    metric_type: "total_value",
    timeframe: "last_90_days",
    breakdown: "age",
  });
  for (const b of ["gender", "country", "city"]) {
    assert.equal(buildDemographicsInsightsParams(b).breakdown, b);
    assert.equal(buildDemographicsInsightsParams(b).metric_type, "total_value");
  }
});

test("day insights aggregate complete success", () => {
  const report = aggregateDayInsightsGroups([
    {
      kind: "reach_time_series",
      metrics: "reach",
      period: "day",
      metricType: null,
      representation: "time_series",
      ok: true,
      data: [{ name: "reach", values: [{ value: 10 }] }],
    },
    {
      kind: "engagement_totals",
      metrics: "views,accounts_engaged",
      period: "day",
      metricType: "total_value",
      representation: "total_value",
      ok: true,
      data: [
        { name: "views", total_value: { value: 5 } },
        { name: "accounts_engaged", total_value: { value: 2 } },
      ],
    },
  ]);
  assert.equal(report.status, "complete");
  assert.equal(report.ok, true);
  assert.equal(report.error, undefined);
  const data = report.data as {
    reach: { representation: string; values: unknown };
    totals: { representation: string; values: unknown };
  };
  assert.equal(data.reach.representation, "time_series");
  assert.equal(data.totals.representation, "total_value");
  assert.match(report.metricTried || "", /reach/);
  assert.match(report.metricTried || "", /views,accounts_engaged/);
});

test("day insights aggregate partial failure", () => {
  const report = aggregateDayInsightsGroups([
    {
      kind: "reach_time_series",
      metrics: "reach",
      period: "day",
      metricType: null,
      representation: "time_series",
      ok: true,
      data: [{ name: "reach" }],
    },
    {
      kind: "engagement_totals",
      metrics: "views,accounts_engaged",
      period: "day",
      metricType: "total_value",
      representation: "total_value",
      ok: false,
      error: "metric_type required",
    },
  ]);
  assert.equal(report.status, "partial");
  assert.equal(report.ok, false);
  assert.match(report.error || "", /engagement_totals/);
  const data = report.data as { reach?: unknown; totals?: unknown };
  assert.ok(data.reach);
  assert.equal(data.totals, undefined);
});

test("day insights aggregate complete failure", () => {
  const report = aggregateDayInsightsGroups([
    {
      kind: "reach_time_series",
      metrics: "reach",
      period: "day",
      metricType: null,
      representation: "time_series",
      ok: false,
      error: "reach failed",
    },
    {
      kind: "engagement_totals",
      metrics: "views,accounts_engaged",
      period: "day",
      metricType: "total_value",
      representation: "total_value",
      ok: false,
      error: "totals failed",
    },
  ]);
  assert.equal(report.status, "failed");
  assert.equal(report.ok, false);
  assert.equal(report.data, undefined);
  assert.match(report.error || "", /reach failed/);
  assert.match(report.error || "", /totals failed/);
});
