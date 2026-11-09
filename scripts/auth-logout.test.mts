import assert from "node:assert/strict";
import test from "node:test";
import {
  hasLikelySupabaseAuthSession,
  isSupabaseAuthKey,
  loggedOutStampActive,
} from "../lib/authStorage.ts";

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

test("likely session is true only when sb auth storage or cookies exist", () => {
  const previousStorage = globalThis.localStorage;
  const previousDocument = globalThis.document;
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      key: (index: number) => [...data.keys()][index] ?? null,
      get length() {
        return data.size;
      },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { cookie: "" },
  });
  try {
    assert.equal(hasLikelySupabaseAuthSession(), false);
    data.set("sb-abc-auth-token", "{}");
    assert.equal(hasLikelySupabaseAuthSession(), true);
  } finally {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: previousStorage });
    Object.defineProperty(globalThis, "document", { configurable: true, value: previousDocument });
  }
});
