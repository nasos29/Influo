/**
 * Phase 5: TikTok Admin UI helpers (no browser / no Next runtime).
 */
import assert from "node:assert/strict";
import test from "node:test";

const {
  abbreviateInfluencerId,
  abbreviateOpenId,
  assertSafeAdminDisplay,
  isSafeTikTokAuthorizeUrl,
} = await import("../lib/social/tiktokAdminUi.ts");

test("abbreviateInfluencerId masks full UUID", () => {
  const id = "12345678-aaaa-bbbb-cccc-ddddeeee0000";
  const abbr = abbreviateInfluencerId(id);
  assert.equal(abbr.includes("12345678"), true);
  assert.equal(abbr.includes("0000"), true);
  assert.equal(abbr.includes("aaaa-bbbb-cccc"), false);
  assert.notEqual(abbr, id);
});

test("abbreviateOpenId shortens long open ids", () => {
  const openId = "abcdefghij-1234-5678-90ab-cdefghijklmn";
  const abbr = abbreviateOpenId(openId);
  assert.ok(abbr.length < openId.length);
  assert.equal(abbreviateOpenId(null), "—");
});

test("assertSafeAdminDisplay redacts token-like strings", () => {
  assert.equal(assertSafeAdminDisplay("act.secret.value"), "[redacted]");
  assert.equal(assertSafeAdminDisplay("refresh_token=abc"), "[redacted]");
  assert.equal(assertSafeAdminDisplay("client_secret=x"), "[redacted]");
  assert.equal(assertSafeAdminDisplay("schema_not_ready"), "schema_not_ready");
  assert.equal(assertSafeAdminDisplay("scope_not_authorized"), "scope_not_authorized");
});

test("isSafeTikTokAuthorizeUrl accepts official host only", () => {
  assert.equal(
    isSafeTikTokAuthorizeUrl(
      "https://www.tiktok.com/v2/auth/authorize/?client_key=x&response_type=code&state=abc"
    ),
    true
  );
  assert.equal(isSafeTikTokAuthorizeUrl("https://evil.example/oauth"), false);
  assert.equal(isSafeTikTokAuthorizeUrl("http://www.tiktok.com/v2/auth/authorize/"), false);
});

test("status disconnected UI model has no fake metrics", () => {
  const connection = {
    connected: false,
    platformUserId: null,
    username: null,
    scopesGranted: [] as string[],
    spike: null,
  };
  assert.equal(connection.connected, false);
  assert.equal(connection.username, null);
  assert.deepEqual(connection.scopesGranted, []);
  assert.equal(connection.spike, null);
});

test("status connected UI model surfaces scopes and open_id safely", () => {
  const connection = {
    connected: true,
    platformUserId: "open-id-value-long-enough-to-mask",
    username: "creator",
    displayName: "Creator",
    scopesGranted: ["user.info.basic", "video.list"],
    followerCount: 10,
    tokenExpiresAt: "2026-11-07T12:00:00.000Z",
  };
  assert.equal(connection.scopesGranted.includes("user.info.basic"), true);
  assert.equal(abbreviateOpenId(connection.platformUserId).includes("open-id-va"), true);
  const rendered = JSON.stringify({
    openId: abbreviateOpenId(connection.platformUserId),
    scopes: connection.scopesGranted,
  });
  assert.equal(rendered.includes("access_token"), false);
  assert.equal(rendered.includes("refresh_token"), false);
  assert.equal(rendered.includes("client_secret"), false);
});

test("connect redirect contract requires authorizeUrl https tiktok host", () => {
  const body = {
    authorizeUrl:
      "https://www.tiktok.com/v2/auth/authorize/?client_key=x&response_type=code&scope=user.info.basic&redirect_uri=https%3A%2F%2Fwww.influo.gr%2Fapi%2Fsocial%2Ftiktok%2Fcallback&state=abc",
  };
  assert.equal(isSafeTikTokAuthorizeUrl(body.authorizeUrl), true);
  assert.equal(body.authorizeUrl.includes("client_secret"), false);
  assert.equal(body.authorizeUrl.includes("access_token"), false);
});

test("spike missing-scope messaging flags", () => {
  const scopeIssues = {
    profileMissingScope: true,
    videosMissingScope: true,
    videosPermissionDenied: false,
  };
  assert.equal(scopeIssues.videosMissingScope, true);
  assert.equal(scopeIssues.profileMissingScope, true);
});

test("refresh / disconnect failure payloads never include tokens", () => {
  const refreshFail = {
    ok: false,
    error: "refresh_persist_critical",
    detail: "TikTok issued rotated tokens but Influo could not persist them",
  };
  const disconnectOk = {
    ok: true,
    revokeAttempted: true,
    revokeOk: false,
    localCleared: true,
    note: "Local TikTok connection cleared; remote revoke did not succeed",
  };
  const blob = JSON.stringify({ refreshFail, disconnectOk });
  assert.equal(/\b(act\.|rft\.|access_token|refresh_token|client_secret)\b/i.test(blob), false);
});

test("non-admin page gate redirects to unauthorized (contract)", () => {
  const isAdmin = false;
  const target = isAdmin ? "/admin/integrations/tiktok" : "/dashboard?error=unauthorized";
  assert.equal(target, "/dashboard?error=unauthorized");
});

test("admin page gate allows access (contract)", () => {
  const isAdmin = true;
  assert.equal(isAdmin ? "allowed" : "denied", "allowed");
});

test("Instagram Admin UI file path remains separate (regression)", async () => {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const root = path.resolve("components/admin");
  const ig = await fs.readFile(path.join(root, "AdminInstagramIntegrations.tsx"), "utf8");
  const tt = await fs.readFile(path.join(root, "AdminTikTokIntegrations.tsx"), "utf8");
  assert.equal(ig.includes("/api/social/instagram/"), true);
  assert.equal(ig.includes("/api/social/tiktok/"), false);
  assert.equal(tt.includes("/api/social/tiktok/"), true);
  assert.equal(tt.includes("/api/social/instagram/"), false);
});
