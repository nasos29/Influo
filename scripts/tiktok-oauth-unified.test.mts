/**
 * Phase 3: TikTok admin config + Login Kit / Display API unit tests.
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

const {
  ADMIN_TT_OAUTH_PURPOSE,
  evaluateAdminTtConnectAccess,
  evaluateAdminTtCallbackOwnership,
  isTikTokTestInfluencerId,
  tiktokTestInfluencerId,
  verifyTikTokTestInfluencerExists,
} = await import("../lib/social/tiktokAdminConfig.ts");

const {
  buildTikTokAuthorizeUrl,
  exchangeTikTokCodeForToken,
  refreshTikTokAccessToken,
  parseTikTokTokenResponse,
  mapTikTokUserProfile,
  mapTikTokVideo,
  fetchTikTokUserInfo,
  fetchTikTokVideoListPage,
  listTikTokVideos,
  runTikTokSpike,
  redactSecrets,
  tiktokClientKey,
  tiktokClientSecret,
  tiktokRedirectUri,
  TIKTOK_DEFAULT_SCOPES,
  TIKTOK_AUTH_BASE,
  TIKTOK_API_BASE,
} = await import("../lib/social/tiktokUnified.ts");

const { signOAuthState, verifyOAuthState, encryptSecret, decryptSecret } = await import(
  "../lib/social/tokenCrypto.ts"
);

const originalFetch = globalThis.fetch;

function mockFetch(handler: typeof fetch) {
  globalThis.fetch = handler as typeof fetch;
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("missing TIKTOK_CLIENT_KEY fails closed", () => {
  const prev = process.env.TIKTOK_CLIENT_KEY;
  delete process.env.TIKTOK_CLIENT_KEY;
  assert.throws(() => tiktokClientKey(), /TIKTOK_CLIENT_KEY/);
  process.env.TIKTOK_CLIENT_KEY = prev;
});

test("missing TIKTOK_CLIENT_SECRET fails closed", () => {
  const prev = process.env.TIKTOK_CLIENT_SECRET;
  delete process.env.TIKTOK_CLIENT_SECRET;
  assert.throws(() => tiktokClientSecret(), /TIKTOK_CLIENT_SECRET/);
  process.env.TIKTOK_CLIENT_SECRET = prev;
});

test("missing TIKTOK_TEST_INFLUENCER_ID → connect 503", () => {
  assert.equal(
    evaluateAdminTtConnectAccess({
      hasUser: true,
      isAdmin: true,
      testInfluencerId: "",
    }).status,
    503
  );
});

test("admin gates: unauth 401 / non-admin 403 / mismatch 403 / ok 200", () => {
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
      queryInfluencerId: "other",
      testInfluencerId: "tt-test-influencer-uuid",
    }).status,
    403
  );
  assert.equal(
    evaluateAdminTtConnectAccess({
      hasUser: true,
      isAdmin: true,
      testInfluencerId: "tt-test-influencer-uuid",
    }).status,
    200
  );
});

test("callback ownership requires admin_tt_test purpose", () => {
  assert.equal(
    evaluateAdminTtCallbackOwnership({
      purpose: "admin_ig_test",
      stateInfluencerId: "tt-test-influencer-uuid",
      testInfluencerId: "tt-test-influencer-uuid",
      stateUidIsAdmin: true,
    }).ok,
    false
  );
  assert.deepEqual(
    evaluateAdminTtCallbackOwnership({
      purpose: ADMIN_TT_OAUTH_PURPOSE,
      stateInfluencerId: "tt-test-influencer-uuid",
      testInfluencerId: "tt-test-influencer-uuid",
      stateUidIsAdmin: true,
    }),
    { ok: true }
  );
});

test("oauth state purpose admin_tt_test signs and verifies", () => {
  const state = signOAuthState({
    influencerId: tiktokTestInfluencerId(),
    uid: "admin-uid",
    purpose: "admin_tt_test",
  });
  const parsed = verifyOAuthState(state);
  assert.ok(parsed);
  assert.equal(parsed!.purpose, "admin_tt_test");
  assert.equal(isTikTokTestInfluencerId(parsed!.influencerId), true);
});

test("authorization URL uses official v2 endpoint and required params", () => {
  const state = "signed.state.value";
  const url = new URL(buildTikTokAuthorizeUrl(state));
  assert.equal(`${url.origin}${url.pathname}`, "https://www.tiktok.com/v2/auth/authorize/");
  assert.ok(TIKTOK_AUTH_BASE.startsWith("https://www.tiktok.com/v2/auth/authorize"));
  assert.equal(url.searchParams.get("client_key"), "tt_client_key_test");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("redirect_uri"), tiktokRedirectUri());
  assert.equal(url.searchParams.get("state"), state);
  const scope = url.searchParams.get("scope") || "";
  for (const s of TIKTOK_DEFAULT_SCOPES) {
    assert.ok(scope.split(",").includes(s), `missing scope ${s}`);
  }
  assert.equal(url.searchParams.has("client_secret"), false);
});

test("parseTikTokTokenResponse validates required fields and expirations", () => {
  const ok = parseTikTokTokenResponse(
    {
      open_id: "open-1",
      scope: "user.info.basic,video.list",
      access_token: "act.test",
      expires_in: 7200,
      refresh_token: "rft.test",
      refresh_expires_in: 15552000,
      token_type: "Bearer",
    },
    200
  );
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.token.openId, "open-1");
    assert.equal(ok.token.expiresIn, 7200);
    assert.equal(ok.token.refreshExpiresIn, 15552000);
  }

  assert.equal(parseTikTokTokenResponse({ access_token: "x" }, 200).ok, false);
  assert.equal(
    parseTikTokTokenResponse(
      {
        open_id: "o",
        access_token: "a",
        refresh_token: "r",
        expires_in: 0,
        refresh_expires_in: 10,
      },
      200
    ).ok,
    false
  );
});

test("code exchange posts form to official token endpoint", async () => {
  let seenUrl = "";
  let seenBody = "";
  mockFetch(async (input, init) => {
    seenUrl = String(input);
    seenBody = String(init?.body || "");
    assert.equal(init?.method, "POST");
    assert.equal(
      (init?.headers as Record<string, string>)?.["Content-Type"],
      "application/x-www-form-urlencoded"
    );
    return new Response(
      JSON.stringify({
        open_id: "open-xyz",
        scope: "user.info.basic",
        access_token: "act.exchange",
        expires_in: 7200,
        refresh_token: "rft.exchange",
        refresh_expires_in: 15552000,
        token_type: "Bearer",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  });

  const result = await exchangeTikTokCodeForToken("auth-code-123");
  assert.equal(result.ok, true);
  assert.equal(seenUrl, `${TIKTOK_API_BASE}/v2/oauth/token/`);
  const params = new URLSearchParams(seenBody);
  assert.equal(params.get("grant_type"), "authorization_code");
  assert.equal(params.get("code"), "auth-code-123");
  assert.equal(params.get("client_key"), "tt_client_key_test");
  assert.equal(params.get("client_secret"), "tt_client_secret_test");
  assert.equal(params.get("redirect_uri"), tiktokRedirectUri());
  if (result.ok) assert.equal(result.token.accessToken, "act.exchange");
});

test("refresh token exchange rotates tokens", async () => {
  mockFetch(async (_input, init) => {
    const params = new URLSearchParams(String(init?.body || ""));
    assert.equal(params.get("grant_type"), "refresh_token");
    assert.equal(params.get("refresh_token"), "rft.old");
    return new Response(
      JSON.stringify({
        open_id: "open-xyz",
        scope: "user.info.basic,video.list",
        access_token: "act.new",
        expires_in: 7200,
        refresh_token: "rft.new",
        refresh_expires_in: 15552000,
        token_type: "Bearer",
      }),
      { status: 200 }
    );
  });

  const result = await refreshTikTokAccessToken("rft.old");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.token.accessToken, "act.new");
    assert.equal(result.token.refreshToken, "rft.new");
  }
});

test("token encrypt/decrypt roundtrip for access and refresh", () => {
  const access = "act.secret.value";
  const refresh = "rft.secret.value";
  const encA = encryptSecret(access);
  const encR = encryptSecret(refresh);
  assert.notEqual(encA, access);
  assert.notEqual(encR, refresh);
  assert.equal(decryptSecret(encA), access);
  assert.equal(decryptSecret(encR), refresh);
});

test("user profile mapping tolerates missing optional fields", () => {
  const mapped = mapTikTokUserProfile({
    open_id: "oid",
    display_name: "Creator",
    follower_count: 12,
  });
  assert.equal(mapped.open_id, "oid");
  assert.equal(mapped.display_name, "Creator");
  assert.equal(mapped.follower_count, 12);
  assert.equal(mapped.union_id, undefined);
  assert.equal(mapped.is_verified, undefined);
  assert.deepEqual(mapTikTokUserProfile(null), {});
});

test("fetchTikTokUserInfo maps Display API response", async () => {
  mockFetch(async (input) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/v2/user/info/");
    assert.ok(url.searchParams.get("fields")?.includes("follower_count"));
    return new Response(
      JSON.stringify({
        data: {
          user: {
            open_id: "oid-1",
            display_name: "Influo",
            follower_count: 100,
            likes_count: 50,
            video_count: 3,
          },
        },
        error: { code: "ok", message: "" },
      }),
      { status: 200 }
    );
  });

  const result = await fetchTikTokUserInfo("act.token");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.user.open_id, "oid-1");
    assert.equal(result.user.follower_count, 100);
  }
});

test("video pagination follows cursor until has_more false", async () => {
  let calls = 0;
  mockFetch(async (input, init) => {
    calls += 1;
    assert.equal(new URL(String(input)).pathname, "/v2/video/list/");
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body || "{}")) as { cursor?: number; max_count?: number };
    assert.ok((body.max_count ?? 0) <= 20);

    if (calls === 1) {
      return new Response(
        JSON.stringify({
          data: {
            videos: [{ id: "v1", title: "One", view_count: 10 }],
            cursor: 111,
            has_more: true,
          },
          error: { code: "ok" },
        }),
        { status: 200 }
      );
    }
    assert.equal(body.cursor, 111);
    return new Response(
      JSON.stringify({
        data: {
          videos: [{ id: "v2", title: "Two" }],
          cursor: 222,
          has_more: false,
        },
        error: { code: "ok" },
      }),
      { status: 200 }
    );
  });

  const result = await listTikTokVideos("act.token", { maxPages: 5 });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.pages, 2);
    assert.equal(result.videos.length, 2);
    assert.equal(result.videos[0]?.id, "v1");
    assert.equal(result.videos[1]?.id, "v2");
  }
});

test("video mapping drops absent fields; ignores rows without id", () => {
  assert.deepEqual(mapTikTokVideo({ title: "no id" }), {
    id: undefined,
    title: "no id",
    video_description: undefined,
    duration: undefined,
    cover_image_url: undefined,
    share_url: undefined,
    embed_link: undefined,
    like_count: undefined,
    comment_count: undefined,
    share_count: undefined,
    view_count: undefined,
    create_time: undefined,
  });
});

test("expired / invalid token surfaced on user info", async () => {
  mockFetch(async () =>
    new Response(
      JSON.stringify({
        data: {},
        error: { code: "access_token_invalid", message: "Access token is invalid or expired." },
      }),
      { status: 401 }
    )
  );
  const result = await fetchTikTokUserInfo("act.expired");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.expiredToken, true);
    assert.equal(result.requiresReauth, true);
  }
});

test("rate limit flagged on video list", async () => {
  mockFetch(async () =>
    new Response(
      JSON.stringify({
        error: { code: "rate_limit_exceeded", message: "Too many requests" },
      }),
      { status: 429 }
    )
  );
  const result = await fetchTikTokVideoListPage("act.token");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.rateLimited, true);
});

test("runTikTokSpike never claims demographics and omits tokens", async () => {
  mockFetch(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.includes("user/info")) {
      return new Response(
        JSON.stringify({
          data: { user: { open_id: "oid", display_name: "X", follower_count: 1 } },
          error: { code: "ok" },
        }),
        { status: 200 }
      );
    }
    return new Response(
      JSON.stringify({
        data: { videos: [{ id: "v1", title: "t" }], cursor: 0, has_more: false },
        error: { code: "ok" },
      }),
      { status: 200 }
    );
  });

  const spike = await runTikTokSpike("act.should.not.leak");
  assert.equal(spike.demographicsSupported, false);
  assert.equal(spike.profile.ok, true);
  assert.equal(spike.videos.ok, true);
  const serialized = JSON.stringify(spike);
  assert.equal(serialized.includes("act.should.not.leak"), false);
});

test("redactSecrets strips tokens and secrets", () => {
  const raw =
    "access_token=act.abc&refresh_token=rft.xyz&client_secret=sekrit&code=authcode&client_key=ck";
  const out = redactSecrets(raw);
  assert.equal(out.includes("act.abc"), false);
  assert.equal(out.includes("sekrit"), false);
  assert.equal(out.includes("authcode"), false);
  assert.match(out, /REDACTED/);
});

test("verifyTikTokTestInfluencerExists fail-closed on missing row", async () => {
  const missing = await verifyTikTokTestInfluencerExists("gone", {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    }),
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.reason, "not_found");

  const found = await verifyTikTokTestInfluencerExists("tt-test-influencer-uuid", {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: "tt-test-influencer-uuid", display_name: "TT Test" },
            error: null,
          }),
        }),
      }),
    }),
  });
  assert.equal(found.ok, true);
  if (found.ok) assert.equal(found.influencer.display_name, "TT Test");
});

test("does not reuse META_IG_TEST_INFLUENCER_ID", () => {
  process.env.META_IG_TEST_INFLUENCER_ID = "ig-only-uuid";
  process.env.TIKTOK_TEST_INFLUENCER_ID = "tt-test-influencer-uuid";
  assert.equal(tiktokTestInfluencerId(), "tt-test-influencer-uuid");
  assert.notEqual(tiktokTestInfluencerId(), process.env.META_IG_TEST_INFLUENCER_ID);
});
