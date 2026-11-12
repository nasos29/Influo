/**
 * Phase 2 only: OAuth purpose union + nonce table isolation helpers.
 * Does not exercise TikTok API routes (not implemented yet).
 */
import assert from "node:assert/strict";
import test from "node:test";

process.env.SOCIAL_TOKEN_ENCRYPTION_KEY =
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY ||
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.SOCIAL_OAUTH_STATE_SECRET =
  process.env.SOCIAL_OAUTH_STATE_SECRET || "test-state-secret-at-least-32-chars!!";

const { evaluateAdminIgCallbackOwnership } = await import("../lib/social/instagramAdminConfig.ts");
const {
  signOAuthState,
  verifyOAuthState,
  MemoryOAuthNonceStore,
  consumeOAuthNonceViaInsert,
  encryptSecret,
  decryptSecret,
} = await import("../lib/social/tokenCrypto.ts");

test("oauth state purpose admin_tt_test roundtrip", () => {
  const state = signOAuthState({
    influencerId: "tt-test-influencer-uuid",
    uid: "admin-uid",
    purpose: "admin_tt_test",
  });
  const parsed = verifyOAuthState(state);
  assert.ok(parsed);
  assert.equal(parsed!.purpose, "admin_tt_test");
  assert.equal(parsed!.influencerId, "tt-test-influencer-uuid");
  assert.ok(parsed!.nonce);
  assert.ok(parsed!.exp > Math.floor(Date.now() / 1000));
});

test("admin_ig_test purpose still roundtrips unchanged", () => {
  const state = signOAuthState({
    influencerId: "ig-test-influencer-uuid",
    uid: "admin-uid",
    purpose: "admin_ig_test",
  });
  const parsed = verifyOAuthState(state);
  assert.ok(parsed);
  assert.equal(parsed!.purpose, "admin_ig_test");
});

test("Instagram callback ownership rejects admin_tt_test purpose", () => {
  const result = evaluateAdminIgCallbackOwnership({
    purpose: "admin_tt_test",
    stateInfluencerId: "inf-test-uuid",
    testInfluencerId: "inf-test-uuid",
    stateUidIsAdmin: true,
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "invalid_state");
});

test("IG and TT nonce stores are isolated (separate insert backends)", async () => {
  const igSeen = new Set<string>();
  const ttSeen = new Set<string>();

  const consumeIg = await consumeOAuthNonceViaInsert(async (row) => {
    if (igSeen.has(row.nonce)) return { error: { code: "23505", message: "duplicate" } };
    igSeen.add(row.nonce);
    return { error: null };
  });
  const consumeTt = await consumeOAuthNonceViaInsert(async (row) => {
    if (ttSeen.has(row.nonce)) return { error: { code: "23505", message: "duplicate" } };
    ttSeen.add(row.nonce);
    return { error: null };
  });

  const igState = signOAuthState({
    influencerId: "ig-inf",
    uid: "admin",
    purpose: "admin_ig_test",
  });
  const ttState = signOAuthState({
    influencerId: "tt-inf",
    uid: "admin",
    purpose: "admin_tt_test",
  });
  const ig = verifyOAuthState(igState)!;
  const tt = verifyOAuthState(ttState)!;

  assert.equal(await consumeIg(ig), "ok");
  // Same nonce string consumed into IG store must not block TT store (different table).
  assert.equal(await consumeTt(ig), "ok");
  assert.equal(await consumeIg(ig), "replay");
  assert.equal(await consumeTt(ig), "replay");

  assert.equal(await consumeTt(tt), "ok");
  assert.equal(await consumeIg(tt), "ok");
  assert.equal(await consumeTt(tt), "replay");
});

test("process-local MemoryOAuthNonceStore rejects replay", () => {
  const store = new MemoryOAuthNonceStore();
  const state = signOAuthState({
    influencerId: "tt-inf",
    uid: "admin",
    purpose: "admin_tt_test",
  });
  const parsed = verifyOAuthState(state)!;
  assert.equal(store.tryConsume(parsed.nonce, parsed.exp), true);
  assert.equal(store.tryConsume(parsed.nonce, parsed.exp), false);
});

test("fail-secure: consumeOAuthNonceViaInsert maps non-unique DB errors to error", async () => {
  const consume = await consumeOAuthNonceViaInsert(async () => ({
    error: { code: "57014", message: "statement timeout" },
  }));
  const state = signOAuthState({
    influencerId: "tt-inf",
    uid: "admin",
    purpose: "admin_tt_test",
  });
  const parsed = verifyOAuthState(state)!;
  assert.equal(await consume(parsed), "error");
});

test("refresh token ciphertext is not plaintext (same encryptSecret)", () => {
  const plain = "tiktok.refresh.token.value";
  const enc = encryptSecret(plain);
  assert.notEqual(enc, plain);
  assert.equal(enc.includes(plain), false);
  assert.equal(decryptSecret(enc), plain);
});
