// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/embed-player-urls.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTikTokPlayerUrl,
  extractTikTokVideoId,
  isTikTokShortLink,
} from "../lib/tikTokPlayer.ts";
import {
  extractInstagramShortcode,
  instagramThumbnailProxySrc,
  isValidInstagramShortcode,
} from "../lib/instagramShortcode.ts";

test("extractTikTokVideoId from watch / photo / embed / player URLs", () => {
  assert.equal(
    extractTikTokVideoId("https://www.tiktok.com/@user/video/7123456789012345678"),
    "7123456789012345678"
  );
  assert.equal(
    extractTikTokVideoId("https://www.tiktok.com/@/photo/7123456789012345678"),
    "7123456789012345678"
  );
  assert.equal(
    extractTikTokVideoId("https://www.tiktok.com/embed/v2/7123456789012345678"),
    "7123456789012345678"
  );
  assert.equal(
    extractTikTokVideoId(
      "https://www.tiktok.com/player/v1/7123456789012345678?autoplay=1"
    ),
    "7123456789012345678"
  );
  assert.equal(extractTikTokVideoId("https://vm.tiktok.com/ZMabcdef/"), null);
  assert.equal(extractTikTokVideoId("https://www.tiktok.com/t/ZTabcdefg/"), null);
  assert.equal(isTikTokShortLink("https://www.tiktok.com/t/ZTabcdefg/"), true);
  assert.equal(isTikTokShortLink("https://vt.tiktok.com/ZSabcdef/"), true);
});

test("buildTikTokPlayerUrl creates muted player/v1 by default", () => {
  const url = buildTikTokPlayerUrl("7123456789012345678");
  assert.equal(
    url,
    "https://www.tiktok.com/player/v1/7123456789012345678?autoplay=1&muted=1&controls=1&description=0&music_info=0&rel=0"
  );
  const unmuted = buildTikTokPlayerUrl("7123456789012345678", { muted: false });
  assert.match(unmuted, /muted=0/);
  assert.throws(() => buildTikTokPlayerUrl("not-a-number"));
});

test("isValidInstagramShortcode and extractInstagramShortcode", () => {
  assert.equal(isValidInstagramShortcode("AbC123xyz"), true);
  assert.equal(isValidInstagramShortcode("ab_12-XY"), true);
  assert.equal(isValidInstagramShortcode("abc"), false); // too short
  assert.equal(isValidInstagramShortcode("bad code!"), false);
  assert.equal(isValidInstagramShortcode("a".repeat(41)), false);

  assert.equal(
    extractInstagramShortcode("https://www.instagram.com/reel/AbC123xyz/"),
    "AbC123xyz"
  );
  assert.equal(
    extractInstagramShortcode("https://www.instagram.com/p/PostId99/?stkn=xyz"),
    "PostId99"
  );
  assert.equal(
    extractInstagramShortcode("https://www.instagram.com/tv/TvId55/"),
    "TvId55"
  );
  assert.equal(
    extractInstagramShortcode("https://www.instagram.com/some_user/reel/AbC123xyz/"),
    "AbC123xyz"
  );
  assert.equal(
    extractInstagramShortcode("https://www.instagram.com/brand.name/p/PostId99/"),
    "PostId99"
  );
  assert.equal(extractInstagramShortcode("https://www.instagram.com/p/ab/"), null);
  assert.equal(extractInstagramShortcode("https://www.instagram.com/stories/user/1/"), null);
  assert.equal(extractInstagramShortcode("https://www.instagram.com/s/aGlnaA/"), null);

  assert.equal(
    instagramThumbnailProxySrc("AbC123xyz"),
    "/api/thumbnail-proxy?ig=AbC123xyz"
  );
});
