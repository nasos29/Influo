import assert from "node:assert/strict";
import test from "node:test";
import { isSupabaseAuthKey, loggedOutStampActive } from "../lib/authStorage.ts";

test("supabase auth keys are the ones logout clears", () => {
  assert.equal(isSupabaseAuthKey("sb-abc-auth-token"), true);
  assert.equal(isSupabaseAuthKey("supabase.auth.token"), true);
  assert.equal(isSupabaseAuthKey("influo-logged-out"), false);
  assert.equal(isSupabaseAuthKey("language"), false);
});

test("a logout stamp blocks a cached session for two minutes", () => {
  const now = 1_000_000;
  assert.equal(loggedOutStampActive(String(now - 1_000), now), true);
  assert.equal(loggedOutStampActive(String(now - 3 * 60 * 1000), now), false);
  assert.equal(loggedOutStampActive(null, now), false);
  assert.equal(loggedOutStampActive("nope", now), false);
});
