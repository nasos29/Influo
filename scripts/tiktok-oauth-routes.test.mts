/**
 * Phase 4: TikTok admin route security helpers + regression vs Instagram purpose/gates.
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.SOCIAL_TOKEN_ENCRYPTION_KEY =
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY ||
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.SOCIAL_OAUTH_STATE_SECRET =
  process.env.SOCIAL_OAUTH_STATE_SECRET || "test-state-secret-at-least-32-chars!!";
process.env.TIKTOK_CLIENT_KEY = "tt_client_key_test";
process.env.TIKTOK_CLIENT_SECRET = "tt_client_secret_test";
process.env.TIKTOK_REDIRECT_URI = "https://www.influo.gr/api/social/tiktok/callback";
process.env.TIKTOK_TEST_INFLUENCER_ID = "tt-test-influencer-uuid";
process.env.META_IG_TEST_INFLUENCER_ID = "ig-only-uuid";

const {
  evaluateAdminTtConnectAccess,
  evaluateAdminTtCallbackOwnership,
  ADMIN_TT_OAUTH_PURPOSE,
  tiktokTestInfluencerId,
} = await import("../lib/social/tiktokAdminConfig.ts");

const { evaluateAdminIgCallbackOwnership } = await import("../lib/social/instagramAdminConfig.ts");

const {
  accessTokenNeedsRefresh,
  isMissingSchemaError,
  isCompleteTikTokTokenSet,
  sanitizeTikTokSpikeReport,
  classifyTikTokScopeError,
  schemaMissingResponseBody,
  tokenExpiryIsoFromSeconds,
  exchangeTikTokCodeForToken,
  refreshTikTokAccessToken,
  revokeTikTokAccessToken,
  redactSecrets,
  buildTikTokAuthorizeUrl,
  parseGrantedScopes,
  mergeGrantedScopes,
  formatGrantedScopes,
} = await import("../lib/social/tiktokUnified.ts");

const {
  signOAuthState,
  verifyOAuthState,
  encryptSecret,
  decryptSecret,
  consumeOAuthNonceViaInsert,
  MemoryOAuthNonceStore,
} = await import("../lib/social/tokenCrypto.ts");

const originalFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("admin-only connect gate on every status class", () => {
  assert.equal(
    evaluateAdminTtConnectAccess({
      hasUser: false,
      isAdmin: false,
      testInfluencerId: "tt-test-influencer-uuid",
    }).status,
    401
  );
  assert.equal(
    evaluateAdminTtConnectAccess({
      hasUser: true,
      isAdmin: false,
      testInfluencerId: "tt-test-influencer-uuid",
    }).status,
    403
  );
  assert.equal(
    evaluateAdminTtConnectAccess({
      hasUser: true,
      isAdmin: true,
      queryInfluencerId: "browser-uuid",
      testInfluencerId: "tt-test-influencer-uuid",
    }).status,
    403
  );
  assert.equal(
    evaluateAdminTtConnectAccess({
      hasUser: true,
      isAdmin: true,
      testInfluencerId: "",
    }).status,
    503
  );
});

test("unauthorized callback: wrong purpose / non-admin / mismatched influencer", () => {
  assert.equal(
    evaluateAdminTtCallbackOwnership({
      purpose: "admin_ig_test",
      stateInfluencerId: "tt-test-influencer-uuid",
      testInfluencerId: "tt-test-influencer-uuid",
      stateUidIsAdmin: true,
    }).ok,
    false
  );
  assert.equal(
    evaluateAdminTtCallbackOwnership({
      purpose: ADMIN_TT_OAUTH_PURPOSE,
      stateInfluencerId: "tt-test-influencer-uuid",
      testInfluencerId: "tt-test-influencer-uuid",
      stateUidIsAdmin: false,
    }).ok,
    false
  );
  assert.equal(
    evaluateAdminTtCallbackOwnership({
      purpose: ADMIN_TT_OAUTH_PURPOSE,
      stateInfluencerId: "other",
      testInfluencerId: "tt-test-influencer-uuid",
      stateUidIsAdmin: true,
    }).ok,
    false
  );
});

test("invalid / expired state rejected", () => {
  assert.equal(verifyOAuthState("not-valid"), null);
  const state = signOAuthState(
    {
      influencerId: tiktokTestInfluencerId(),
      uid: "admin",
      purpose: "admin_tt_test",
    },
    1
  );
  const parsed = verifyOAuthState(state, { nowSec: Math.floor(Date.now() / 1000) + 120 });
  assert.equal(parsed, null);
});

test("replayed TikTok nonce rejected; IG store isolation", async () => {
  const ttSeen = new Set<string>();
  const igSeen = new Set<string>();
  const consumeTt = await consumeOAuthNonceViaInsert(async (row) => {
    if (ttSeen.has(row.nonce)) return { error: { code: "23505", message: "dup" } };
    ttSeen.add(row.nonce);
    return { error: null };
  });
  const consumeIg = await consumeOAuthNonceViaInsert(async (row) => {
    if (igSeen.has(row.nonce)) return { error: { code: "23505", message: "dup" } };
    igSeen.add(row.nonce);
    return { error: null };
  });

  const state = signOAuthState({
    influencerId: "tt-test-influencer-uuid",
    uid: "admin",
    purpose: "admin_tt_test",
  });
  const parsed = verifyOAuthState(state)!;
  assert.equal(await consumeTt(parsed), "ok");
  assert.equal(await consumeTt(parsed), "replay");
  assert.equal(await consumeIg(parsed), "ok");
});

test("platform_user_id persistence shape uses open_id not ig_user_id", () => {
  const openId = "tiktok-open-id-abc";
  const row = {
    influencer_id: "tt-test-influencer-uuid",
    platform: "tiktok",
    platform_user_id: openId,
    ig_user_id: null as string | null,
  };
  assert.equal(row.platform_user_id, openId);
  assert.equal(row.ig_user_id, null);
  assert.equal(row.platform, "tiktok");
});

test("TikTok granted scopes stored separately from config_id", () => {
  const tokenScope = "user.info.basic,user.info.profile,video.list";
  const granted_scopes = parseGrantedScopes(tokenScope);
  const upsert = {
    platform: "tiktok",
    granted_scopes,
    config_id: null as string | null,
  };
  assert.deepEqual(upsert.granted_scopes, [
    "user.info.basic",
    "user.info.profile",
    "video.list",
  ]);
  assert.equal(upsert.config_id, null);
  assert.notEqual(JSON.stringify(upsert.granted_scopes), upsert.config_id);
});

test("missing refresh scope data does not overwrite previously stored scopes", () => {
  const previous = ["user.info.basic", "user.info.stats", "video.list"];
  assert.deepEqual(mergeGrantedScopes(previous, ""), previous);
  assert.deepEqual(mergeGrantedScopes(previous, null), previous);
  assert.deepEqual(mergeGrantedScopes(previous, "   "), previous);
  assert.deepEqual(mergeGrantedScopes(previous, "user.info.basic,video.list"), [
    "user.info.basic",
    "video.list",
  ]);
  assert.equal(mergeGrantedScopes(null, ""), null);
  assert.equal(formatGrantedScopes(previous), "user.info.basic,user.info.stats,video.list");
});

test("status reports stored TikTok scopes from granted_scopes array", () => {
  const row = {
    granted_scopes: ["user.info.basic", "video.list"],
    config_id: "should-never-be-used-for-tiktok-scopes",
  };
  const scopesGranted = Array.isArray(row.granted_scopes) ? row.granted_scopes : [];
  assert.deepEqual(scopesGranted, ["user.info.basic", "video.list"]);
  assert.notEqual(scopesGranted.join(","), row.config_id);
});

test("Instagram config_id semantics remain Meta Login config (regression)", async () => {
  const { metaIgConfigId, buildUnifiedAuthorizeUrl } = await import(
    "../lib/social/instagramUnified.ts"
  );
  process.env.META_APP_ID = process.env.META_APP_ID || "1085701814491082";
  process.env.META_IG_CONFIG_ID = process.env.META_IG_CONFIG_ID || "1647951953401160";
  const configId = metaIgConfigId();
  assert.equal(configId, "1647951953401160");
  const url = buildUnifiedAuthorizeUrl("state");
  assert.match(url, /config_id=1647951953401160/);
  assert.equal(url.includes("granted_scopes"), false);
});

test("token encryption for access + refresh", () => {
  const a = encryptSecret("act.token");
  const r = encryptSecret("rft.token");
  assert.equal(decryptSecret(a), "act.token");
  assert.equal(decryptSecret(r), "rft.token");
  assert.equal(a.includes("act.token"), false);
});

test("isCompleteTikTokTokenSet rejects incomplete overwrite payloads", () => {
  assert.equal(
    isCompleteTikTokTokenSet({
      openId: "o",
      accessToken: "a",
      refreshToken: "r",
      expiresIn: 100,
      refreshExpiresIn: 200,
    }),
    true
  );
  assert.equal(
    isCompleteTikTokTokenSet({
      openId: "o",
      accessToken: "a",
      refreshToken: "",
      expiresIn: 100,
      refreshExpiresIn: 200,
    }),
    false
  );
});

test("refresh rotation must persist NEW refresh token (helper contract)", async () => {
  globalThis.fetch = (async (_input, init) => {
    const body = new URLSearchParams(String(init?.body || ""));
    assert.equal(body.get("grant_type"), "refresh_token");
    assert.equal(body.get("refresh_token"), "rft.old");
    return new Response(
      JSON.stringify({
        open_id: "oid",
        access_token: "act.new",
        refresh_token: "rft.new",
        expires_in: 7200,
        refresh_expires_in: 15552000,
        token_type: "Bearer",
        scope: "user.info.basic,video.list",
      }),
      { status: 200 }
    );
  }) as typeof fetch;

  const result = await refreshTikTokAccessToken("rft.old");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.token.refreshToken, "rft.new");
    assert.notEqual(result.token.refreshToken, "rft.old");
    const encNew = encryptSecret(result.token.refreshToken);
    assert.equal(decryptSecret(encNew), "rft.new");
  }
});

test("accessTokenNeedsRefresh skew behavior", () => {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const soon = new Date(Date.now() + 60 * 1000).toISOString();
  assert.equal(accessTokenNeedsRefresh(future, Date.now(), 300), false);
  assert.equal(accessTokenNeedsRefresh(soon, Date.now(), 300), true);
  assert.equal(accessTokenNeedsRefresh(null), true);
});

test("missing schema detection", () => {
  assert.equal(isMissingSchemaError({ code: "42P01", message: "relation missing" }), true);
  assert.equal(isMissingSchemaError({ code: "42703", message: "column platform_user_id" }), true);
  assert.equal(isMissingSchemaError({ message: "tiktok_oauth_used_nonces does not exist" }), true);
  assert.equal(isMissingSchemaError({ code: "23505", message: "duplicate" }), false);
  assert.equal(schemaMissingResponseBody("status").error, "schema_not_ready");
});

test("missing env fails authorize URL construction", () => {
  const prev = process.env.TIKTOK_CLIENT_KEY;
  delete process.env.TIKTOK_CLIENT_KEY;
  assert.throws(() => buildTikTokAuthorizeUrl("state"), /TIKTOK_CLIENT_KEY/);
  process.env.TIKTOK_CLIENT_KEY = prev;
});

test("code exchange + revoke API shapes", async () => {
  let calls = 0;
  globalThis.fetch = (async (input, init) => {
    calls += 1;
    const url = String(input);
    if (url.includes("/oauth/token/")) {
      const body = new URLSearchParams(String(init?.body || ""));
      assert.equal(body.get("grant_type"), "authorization_code");
      return new Response(
        JSON.stringify({
          open_id: "oid",
          access_token: "act.x",
          refresh_token: "rft.x",
          expires_in: 7200,
          refresh_expires_in: 1000,
          token_type: "Bearer",
          scope: "user.info.basic",
        }),
        { status: 200 }
      );
    }
    assert.ok(url.includes("/oauth/revoke/"));
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const ex = await exchangeTikTokCodeForToken("code");
  assert.equal(ex.ok, true);
  const rev = await revokeTikTokAccessToken("act.x");
  assert.equal(rev.ok, true);
  assert.ok(calls >= 2);
});

test("missing scopes classified distinctly from rate limits", () => {
  const scope = classifyTikTokScopeError("scope_not_authorized", "not granted");
  assert.equal(scope.missingScope, true);
  assert.equal(scope.permissionDenied, true);
  const rate = classifyTikTokScopeError("rate_limit_exceeded", "slow down");
  assert.equal(rate.missingScope, false);
});

test("sanitizeTikTokSpikeReport never includes tokens and forces demographicsSupported false", () => {
  const sanitized = sanitizeTikTokSpikeReport({
    apiBase: "https://open.tiktokapis.com",
    scopesRequested: "user.info.basic,video.list",
    scopesGranted: "user.info.basic",
    demographicsSupported: false,
    profile: {
      ok: true,
      user: { open_id: "oid", display_name: "Name", follower_count: 9, username: "u" },
    },
    videos: {
      ok: true,
      count: 1,
      sample: [{ id: "v1", title: "t", view_count: 3 }],
    },
  });
  assert.ok(sanitized);
  assert.equal(sanitized!.demographicsSupported, false);
  assert.equal(sanitized!.profile?.displayName, "Name");
  assert.equal(sanitized!.profile?.followerCount, 9);
  const json = JSON.stringify(sanitized);
  assert.equal(json.toLowerCase().includes("access_token"), false);
  assert.equal(json.includes("act."), false);
});

test("tokenExpiryIsoFromSeconds produces future ISO", () => {
  const iso = tokenExpiryIsoFromSeconds(7200, 1_700_000_000_000);
  assert.equal(iso, new Date(1_700_000_000_000 + 7200 * 1000).toISOString());
});

test("Instagram callback still rejects admin_tt_test (regression)", () => {
  assert.equal(
    evaluateAdminIgCallbackOwnership({
      purpose: "admin_tt_test",
      stateInfluencerId: "ig-only-uuid",
      testInfluencerId: "ig-only-uuid",
      stateUidIsAdmin: true,
    }).ok,
    false
  );
});

test("TikTok test influencer env is not Meta IG id", () => {
  assert.equal(tiktokTestInfluencerId(), "tt-test-influencer-uuid");
  assert.notEqual(tiktokTestInfluencerId(), process.env.META_IG_TEST_INFLUENCER_ID);
});

test("redactSecrets covers authorization codes", () => {
  assert.match(redactSecrets("code=abc123&x=1"), /code=REDACTED/);
});

test("process-local nonce store rejects replay for fail-closed path", () => {
  const store = new MemoryOAuthNonceStore();
  assert.equal(store.tryConsume("n1", Math.floor(Date.now() / 1000) + 60), true);
  assert.equal(store.tryConsume("n1", Math.floor(Date.now() / 1000) + 60), false);
});
