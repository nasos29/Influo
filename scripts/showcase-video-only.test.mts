import assert from "node:assert/strict";
import test from "node:test";
import { showcasePostFields } from "../lib/showcasePostUrl.ts";

test("showcasePostFields rejects empty / invalid URLs (no grey cards)", () => {
  assert.deepEqual(showcasePostFields(null), { postUrl: null, postProvider: null });
  assert.deepEqual(showcasePostFields(""), { postUrl: null, postProvider: null });
  assert.deepEqual(showcasePostFields("   "), { postUrl: null, postProvider: null });
  assert.deepEqual(showcasePostFields("https://example.com/x"), {
    postUrl: null,
    postProvider: null,
  });
});

test("showcasePostFields accepts IG / TikTok / YouTube HTTPS", () => {
  const ig = showcasePostFields("https://www.instagram.com/reel/AbC123xyz/");
  assert.equal(ig.postUrl, "https://www.instagram.com/reel/AbC123xyz/");
  assert.equal(ig.postProvider, "instagram");

  const tt = showcasePostFields("https://www.tiktok.com/@u/video/7123456789012345678");
  assert.equal(tt.postProvider, "tiktok");
  assert.ok(tt.postUrl);

  const yt = showcasePostFields("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  assert.equal(yt.postProvider, "youtube");
  assert.ok(yt.postUrl);
});
