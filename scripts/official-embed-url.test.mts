// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/official-embed-url.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOfficialEmbedUrl,
  getVideoEmbedApiUrl,
  getVideoThumbnail,
  isEmbeddableVideoUrl,
  resolveYouTubeVideoId,
} from "../lib/videoThumbnail.ts";
import { extractInstagramShortcode, extractInstagramMedia } from "../lib/instagramShortcode.ts";
import { isTikTokShortLink } from "../lib/tikTokPlayer.ts";

test("getVideoThumbnail: YouTube uses hqdefault (not maxresdefault)", () => {
  assert.equal(
    getVideoThumbnail("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
  );
  assert.equal(
    getVideoThumbnail("https://youtu.be/dQw4w9WgXcQ"),
    "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
  );
});

test("getVideoThumbnail: Instagram/TikTok return video-thumbnail API path", () => {
  assert.match(
    getVideoThumbnail("https://www.instagram.com/reel/AbC123xyz/") || "",
    /^\/api\/video-thumbnail\?url=/
  );
  assert.match(
    getVideoThumbnail("https://www.instagram.com/someuser/reel/AbC123xyz/") || "",
    /^\/api\/video-thumbnail\?url=/
  );
  assert.match(
    getVideoThumbnail("https://www.instagram.com/tv/TvId55/") || "",
    /^\/api\/video-thumbnail\?url=/
  );
  assert.match(
    getVideoThumbnail("https://www.tiktok.com/@user/video/7123456789012345678") || "",
    /^\/api\/video-thumbnail\?url=/
  );
  assert.match(
    getVideoThumbnail("https://www.tiktok.com/t/ZTabcdefg/") || "",
    /^\/api\/video-thumbnail\?url=/
  );
  assert.match(
    getVideoThumbnail("https://vm.tiktok.com/ZMabcdef/") || "",
    /^\/api\/video-thumbnail\?url=/
  );
});

test("Instagram username media paths extract shortcode", () => {
  assert.equal(
    extractInstagramShortcode("https://www.instagram.com/someuser/reel/AbC123xyz/"),
    "AbC123xyz"
  );
  assert.equal(
    extractInstagramShortcode("https://www.instagram.com/brand.name/p/PostId99/"),
    "PostId99"
  );
  assert.equal(
    extractInstagramShortcode("https://www.instagram.com/creator/tv/TvId55/"),
    "TvId55"
  );
  assert.deepEqual(extractInstagramMedia("https://instagram.com/u/reel/Code99xx/"), {
    kind: "reel",
    code: "Code99xx",
  });
  assert.equal(
    buildOfficialEmbedUrl("https://www.instagram.com/someuser/reel/AbC123xyz/"),
    "https://www.instagram.com/reel/AbC123xyz/embed"
  );
});

test("TikTok /t/ short links recognized like vm/vt", () => {
  assert.equal(isTikTokShortLink("https://www.tiktok.com/t/ZTabcdefg/"), true);
  assert.equal(isTikTokShortLink("https://tiktok.com/t/ZTxyz123"), true);
  assert.equal(isTikTokShortLink("https://vm.tiktok.com/ZMabcdef/"), true);
  assert.equal(isTikTokShortLink("https://vt.tiktok.com/ZSabcdef/"), true);
  assert.equal(isTikTokShortLink("https://www.tiktok.com/@user/video/7123456789012345678"), false);
});

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
  assert.equal(
    buildOfficialEmbedUrl("https://m.youtube.com/shorts/AbCdEfGhIjK"),
    "https://www.youtube.com/embed/AbCdEfGhIjK?rel=0&modestbranding=1&playsinline=1"
  );
  assert.equal(
    buildOfficialEmbedUrl("https://youtu.be/dQw4w9WgXcQ?si=shareToken"),
    "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1&playsinline=1"
  );
  assert.equal(resolveYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(resolveYouTubeVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
});

test("buildOfficialEmbedUrl: TikTok returns null (needs API resolve)", () => {
  assert.equal(
    buildOfficialEmbedUrl("https://www.tiktok.com/@user/video/7123456789012345678"),
    null
  );
  assert.equal(buildOfficialEmbedUrl("https://vm.tiktok.com/ZMabcdef/"), null);
  assert.equal(buildOfficialEmbedUrl("https://www.tiktok.com/t/ZTabcdefg/"), null);
});

test("getVideoEmbedApiUrl uses official IG/YT and API for TikTok", () => {
  assert.equal(
    getVideoEmbedApiUrl("https://www.instagram.com/reel/AbC123xyz/"),
    "https://www.instagram.com/reel/AbC123xyz/embed"
  );
  assert.equal(
    getVideoEmbedApiUrl("https://www.instagram.com/user/reel/AbC123xyz/"),
    "https://www.instagram.com/reel/AbC123xyz/embed"
  );
  assert.match(
    getVideoEmbedApiUrl("https://www.tiktok.com/@user/video/7123456789012345678"),
    /^\/api\/video-embed\?url=/
  );
  assert.match(
    getVideoEmbedApiUrl("https://www.tiktok.com/t/ZTabcdefg/"),
    /^\/api\/video-embed\?url=/
  );
});

test("isEmbeddableVideoUrl accepts specific media; rejects profiles/channels/stories", () => {
  assert.equal(isEmbeddableVideoUrl("https://www.instagram.com/reel/AbC123xyz/"), true);
  assert.equal(isEmbeddableVideoUrl("https://www.instagram.com/creator/reel/AbC123xyz/"), true);
  assert.equal(isEmbeddableVideoUrl("https://www.instagram.com/creator/p/PostId99/"), true);
  assert.equal(isEmbeddableVideoUrl("https://www.tiktok.com/@user/video/7123456789012345678"), true);
  assert.equal(isEmbeddableVideoUrl("https://www.tiktok.com/t/ZTabcdefg/"), true);
  assert.equal(isEmbeddableVideoUrl("https://vm.tiktok.com/ZMabcdef/"), true);
  assert.equal(isEmbeddableVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), true);
  assert.equal(isEmbeddableVideoUrl("https://www.youtube.com/shorts/abcdefghijk"), true);

  assert.equal(isEmbeddableVideoUrl("https://www.instagram.com/someuser/"), false);
  assert.equal(isEmbeddableVideoUrl("https://www.instagram.com/someuser"), false);
  assert.equal(isEmbeddableVideoUrl("https://www.instagram.com/stories/someuser/123/"), false);
  assert.equal(isEmbeddableVideoUrl("https://www.instagram.com/s/aGlnaGxpZ2h0OjE/"), false);
  assert.equal(isEmbeddableVideoUrl("https://www.tiktok.com/@someuser"), false);
  assert.equal(isEmbeddableVideoUrl("https://www.tiktok.com/@someuser/"), false);
  assert.equal(isEmbeddableVideoUrl("https://www.youtube.com/@SomeChannel"), false);
  assert.equal(isEmbeddableVideoUrl("https://www.youtube.com/channel/UCxxxxxxxx"), false);
  assert.equal(isEmbeddableVideoUrl(""), false);
});
