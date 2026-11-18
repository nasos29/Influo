// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/chunk-load-error.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  CHUNK_RELOAD_KEY,
  clearChunkReloadToken,
  isStaleChunkError,
  takeChunkReloadToken,
} from "../lib/chunkLoadError.ts";

test("isStaleChunkError detects Next chunk and CSS load failures", () => {
  assert.equal(isStaleChunkError("ChunkLoadError: Loading chunk 123 failed"), true);
  assert.equal(isStaleChunkError("Loading CSS chunk 36af58e52d93594f failed"), true);
  assert.equal(isStaleChunkError("Failed to fetch dynamically imported module"), true);
  assert.equal(
    isStaleChunkError("error loading /_next/static/chunks/app/page-a6151f10ffe41c43.js"),
    true
  );
  assert.equal(isStaleChunkError("TypeError: undefined is not a function"), false);
});

test("takeChunkReloadToken allows one reload then blocks until cleared", () => {
  const store: Record<string, string> = {};
  globalThis.sessionStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  } as Storage;
  assert.equal(takeChunkReloadToken(), true);
  assert.equal(store[CHUNK_RELOAD_KEY], "1");
  assert.equal(takeChunkReloadToken(), false);
  clearChunkReloadToken();
  assert.equal(store[CHUNK_RELOAD_KEY], undefined);
  assert.equal(takeChunkReloadToken(), true);
});
