import assert from "node:assert/strict";
import test from "node:test";

process.env.SOCIAL_TOKEN_ENCRYPTION_KEY =
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY ||
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.SOCIAL_OAUTH_STATE_SECRET =
  process.env.SOCIAL_OAUTH_STATE_SECRET || "test-state-secret-at-least-32-chars!!";
process.env.META_IG_TEST_INFLUENCER_ID = "inf-test-uuid";

const {
  evaluateAdminIgConnectAccess,
  evaluateAdminIgCallbackOwnership,
  isMetaIgTestInfluencerId,
  metaIgTestInfluencerId,
} = await import("../lib/social/instagramAdminConfig.ts");
const {
  signOAuthState,
  verifyOAuthState,
  MemoryOAuthNonceStore,
  consumeOAuthNonceViaInsert,
  encryptSecret,
} = await import("../lib/social/tokenCrypto.ts");

test("unauthenticated connect → 401", () => {
  assert.equal(
    evaluateAdminIgConnectAccess({
      hasUser: false,
      isAdmin: false,
      testInfluencerId: "inf-test-uuid",
    }).status,
    401
  );
});

test("ordinary authenticated user connect → 403", () => {
  assert.equal(
    evaluateAdminIgConnectAccess({
      hasUser: true,
      isAdmin: false,
      testInfluencerId: "inf-test-uuid",
    }).status,
    403
  );
});

test("admin connect with wrong influencerId query → 403", () => {
  assert.equal(
    evaluateAdminIgConnectAccess({
      hasUser: true,
      isAdmin: true,
      queryInfluencerId: "other-uuid",
      testInfluencerId: "inf-test-uuid",
    }).status,
    403
  );
});

test("admin connect with designated influencer → 200", () => {
  assert.equal(
    evaluateAdminIgConnectAccess({
      hasUser: true,
      isAdmin: true,
      queryInfluencerId: "inf-test-uuid",
      testInfluencerId: "inf-test-uuid",
    }).status,
    200
  );
  assert.equal(
    evaluateAdminIgConnectAccess({
      hasUser: true,
      isAdmin: true,
      testInfluencerId: "inf-test-uuid",
    }).status,
    200
  );
});

test("missing META_IG_TEST_INFLUENCER_ID → 503", () => {
  assert.equal(
    evaluateAdminIgConnectAccess({
      hasUser: true,
      isAdmin: true,
      testInfluencerId: "",
    }).status,
    503
  );
});

test("oauth state purpose admin_ig_test roundtrip", () => {
  const state = signOAuthState({
    influencerId: metaIgTestInfluencerId(),
    uid: "admin-uid",
    purpose: "admin_ig_test",
  });
  const parsed = verifyOAuthState(state);
  assert.ok(parsed);
  assert.equal(parsed!.purpose, "admin_ig_test");
  assert.equal(parsed!.influencerId, "inf-test-uuid");
  assert.equal(isMetaIgTestInfluencerId(parsed!.influencerId), true);
});

test("callback ownership rejects non-admin and mismatched influencer", () => {
  assert.equal(
    evaluateAdminIgCallbackOwnership({
      purpose: "admin_ig_test",
      stateInfluencerId: "inf-test-uuid",
      testInfluencerId: "inf-test-uuid",
      stateUidIsAdmin: false,
    }).ok,
    false
  );
  assert.equal(
    evaluateAdminIgCallbackOwnership({
      purpose: "admin_ig_test",
      stateInfluencerId: "wrong",
      testInfluencerId: "inf-test-uuid",
      stateUidIsAdmin: true,
    }).ok,
    false
  );
  assert.equal(
    evaluateAdminIgCallbackOwnership({
      purpose: undefined,
      stateInfluencerId: "inf-test-uuid",
      testInfluencerId: "inf-test-uuid",
      stateUidIsAdmin: true,
    }).ok,
    false
  );
  assert.deepEqual(
    evaluateAdminIgCallbackOwnership({
      purpose: "admin_ig_test",
      stateInfluencerId: "inf-test-uuid",
      testInfluencerId: "inf-test-uuid",
      stateUidIsAdmin: true,
    }),
    { ok: true }
  );
});

test("replayed oauth nonce is rejected", () => {
  const store = new MemoryOAuthNonceStore();
  const state = signOAuthState({
    influencerId: "inf-test-uuid",
    uid: "admin-uid",
    purpose: "admin_ig_test",
  });
  const parsed = verifyOAuthState(state);
  assert.ok(parsed);
  assert.equal(store.tryConsume(parsed!.nonce, parsed!.exp), true);
  assert.equal(store.tryConsume(parsed!.nonce, parsed!.exp), false);
});

test("consumeOAuthNonceViaInsert maps unique violation to replay", async () => {
  const seen = new Set<string>();
  const consume = await consumeOAuthNonceViaInsert(async (row) => {
    if (seen.has(row.nonce)) return { error: { code: "23505", message: "duplicate" } };
    seen.add(row.nonce);
    return { error: null };
  });
  const state = signOAuthState({
    influencerId: "inf-test-uuid",
    uid: "admin-uid",
    purpose: "admin_ig_test",
  });
  const parsed = verifyOAuthState(state)!;
  assert.equal(await consume(parsed), "ok");
  assert.equal(await consume(parsed), "replay");
});

test("encrypted token at rest is not plaintext", () => {
  const plain = "IGAA.test.access.token.value";
  const enc = encryptSecret(plain);
  assert.notEqual(enc, plain);
  assert.equal(enc.includes(plain), false);
  assert.match(enc, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i);
});

test("callback cannot bind arbitrary influencer via query alone", () => {
  // Connect gate ignores privilege of query influencer; mismatch → 403.
  assert.equal(
    evaluateAdminIgConnectAccess({
      hasUser: true,
      isAdmin: true,
      queryInfluencerId: "production-influencer-uuid",
      testInfluencerId: "inf-test-uuid",
    }).status,
    403
  );
  assert.equal(
    evaluateAdminIgCallbackOwnership({
      purpose: "admin_ig_test",
      stateInfluencerId: "production-influencer-uuid",
      testInfluencerId: "inf-test-uuid",
      stateUidIsAdmin: true,
    }).ok,
    false
  );
});
