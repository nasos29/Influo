// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/video-links.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanVideoLink,
  ensureHttps,
  extractFirstUrl,
  isFacebookVideoUrl,
  prepareVideosForSave,
} from "../lib/videoLinks.ts";

test("extractFirstUrl keeps only the first URL from pasted text", () => {
  assert.equal(
    extractFirstUrl(
      "Check this https://www.instagram.com/reel/AbC123xyz/ #fashion #greece more text"
    ),
    "https://www.instagram.com/reel/AbC123xyz/"
  );
  assert.equal(
    extractFirstUrl("www.tiktok.com/@u/video/7123456789012345678 cool"),
    "www.tiktok.com/@u/video/7123456789012345678"
  );
  assert.equal(extractFirstUrl(""), null);
});

test("ensureHttps adds protocol when missing", () => {
  assert.equal(
    ensureHttps("instagram.com/reel/AbC123xyz/"),
    "https://instagram.com/reel/AbC123xyz/"
  );
  assert.equal(
    ensureHttps("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  );
});

test("isFacebookVideoUrl detects facebook hosts", () => {
  assert.equal(isFacebookVideoUrl("https://www.facebook.com/watch/?v=123"), true);
  assert.equal(isFacebookVideoUrl("https://m.facebook.com/story.php?id=1"), true);
  assert.equal(isFacebookVideoUrl("https://fb.watch/abc123/"), true);
  assert.equal(isFacebookVideoUrl("https://fb.com/watch/123"), true);
  assert.equal(isFacebookVideoUrl("facebook.com/reel/xyz"), true);
  assert.equal(isFacebookVideoUrl("https://www.instagram.com/reel/AbC/"), false);
  assert.equal(isFacebookVideoUrl("https://www.tiktok.com/@u/video/1"), false);
  assert.equal(isFacebookVideoUrl("https://www.youtube.com/watch?v=x"), false);
});

test("cleanVideoLink rejects Facebook and cleans others", () => {
  assert.deepEqual(cleanVideoLink(""), { ok: false, reason: "empty" });
  assert.deepEqual(cleanVideoLink("https://fb.watch/xyz/"), {
    ok: false,
    reason: "facebook",
  });
  assert.deepEqual(
    cleanVideoLink("see https://www.instagram.com/reel/AbC123xyz/ please"),
    { ok: true, url: "https://www.instagram.com/reel/AbC123xyz/" }
  );
  assert.deepEqual(cleanVideoLink("youtu.be/dQw4w9WgXcQ"), {
    ok: true,
    url: "https://youtu.be/dQw4w9WgXcQ",
  });
});

test("prepareVideosForSave cleans list and fails on Facebook", () => {
  assert.deepEqual(
    prepareVideosForSave([
      "",
      "https://www.instagram.com/reel/AbC123xyz/",
      "check https://www.tiktok.com/@u/video/1 #tag",
    ]),
    {
      ok: true,
      videos: [
        "https://www.instagram.com/reel/AbC123xyz/",
        "https://www.tiktok.com/@u/video/1",
      ],
    }
  );
  assert.deepEqual(
    prepareVideosForSave(["https://www.facebook.com/watch/?v=1"]),
    { ok: false, reason: "facebook" }
  );
});
