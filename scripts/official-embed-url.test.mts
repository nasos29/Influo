// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/official-embed-url.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOfficialEmbedUrl,
  getIframelyEmbedUrl,
  resolveYouTubeVideoId,
} from "../lib/videoThumbnail.ts";

test("buildOfficialEmbedUrl: Instagram reel/p/tv", () => {
  assert.equal(
    buildOfficialEmbedUrl("https://www.instagram.com/reel/AbC123xyz/"),
    "https://www.instagram.com/reel/AbC123xyz/embed"
  );
  assert.equal(
    buildOfficialEmbedUrl("https://www.instagram.com/p/PostId99/?utm_source=ig"),
    "https://www.instagram.com/p/PostId99/embed"
  );
  assert.equal(
    buildOfficialEmbedUrl("https://www.instagram.com/tv/TvId55/"),
    "https://www.instagram.com/tv/TvId55/embed"
  );
});

test("buildOfficialEmbedUrl: YouTube with optional autoplay", () => {
  assert.equal(
    buildOfficialEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1"
  );
  assert.equal(
    buildOfficialEmbedUrl("https://youtu.be/dQw4w9WgXcQ", { autoplay: true }),
    "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1&autoplay=1"
  );
  assert.equal(
    buildOfficialEmbedUrl("https://www.youtube.com/shorts/abcdefghijk"),
    "https://www.youtube.com/embed/abcdefghijk?rel=0&modestbranding=1&playsinline=1"
  );
  assert.equal(resolveYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
});

test("buildOfficialEmbedUrl: TikTok returns null (needs API resolve)", () => {
  assert.equal(
    buildOfficialEmbedUrl("https://www.tiktok.com/@user/video/7123456789012345678"),
    null
  );
  assert.equal(buildOfficialEmbedUrl("https://vm.tiktok.com/ZMabcdef/"), null);
});

test("getIframelyEmbedUrl uses official IG/YT and API for TikTok", () => {
  assert.equal(
    getIframelyEmbedUrl("https://www.instagram.com/reel/AbC123xyz/"),
    "https://www.instagram.com/reel/AbC123xyz/embed"
  );
  assert.match(
    getIframelyEmbedUrl("https://www.tiktok.com/@user/video/7123456789012345678"),
    /^\/api\/video-embed\?url=/
  );
});
