// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/video-thumbnail-extract.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeJsonEscapedUrl,
  extractOgImageFromHtml,
  extractTikTokCoverFromHtml,
  isCdnThumbnailUrl,
  isGenericLogoThumbnail,
  toDisplayThumbnailSrc,
} from "../lib/videoThumbnailExtract.ts";
import { isAllowedThumbnailHost } from "../lib/thumbnailProxyHosts.ts";
import { getVideoThumbnail, resolveYouTubeVideoId } from "../lib/videoThumbnail.ts";

test("isAllowedThumbnailHost accepts EU TikTok CDN, rejects lookalike attacker hosts", () => {
  assert.equal(isAllowedThumbnailHost("p19-common-sign.tiktokcdn-eu.com"), true);
  assert.equal(isAllowedThumbnailHost("tiktokcdn-eu.com"), true);
  assert.equal(isAllowedThumbnailHost("sf16-website-login.neutral.ttwstatic.com"), true);
  assert.equal(isAllowedThumbnailHost("evil-tiktokcdn-eu.com.attacker.net"), false);
  assert.equal(isAllowedThumbnailHost("not-tiktokcdn-eu.com"), false);
});

test("isGenericLogoThumbnail rejects tiktok-logo, /static/images/, logo.png", () => {
  assert.equal(
    isGenericLogoThumbnail("https://www.tiktok.com/tiktok-logo.png"),
    true
  );
  assert.equal(
    isGenericLogoThumbnail("https://lf16-tiktok-web.ttcdn-us.com/obj/tiktok-web-pc-web/_next/static/images/logo.png"),
    true
  );
  assert.equal(
    isGenericLogoThumbnail("https://example.com/assets/logo.png"),
    true
  );
  assert.equal(
    isGenericLogoThumbnail(
      "https://p16-sign.tiktokcdn-us.com/obj/tos-useast5/cover~tplv.webp"
    ),
    false
  );
});

test("YouTube shorts / m.youtube / youtu.be?si= resolve to hqdefault", () => {
  assert.equal(resolveYouTubeVideoId("https://www.youtube.com/shorts/abcdefghijk"), "abcdefghijk");
  assert.equal(resolveYouTubeVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(resolveYouTubeVideoId("https://m.youtube.com/shorts/AbCdEfGhIjK"), "AbCdEfGhIjK");
  assert.equal(
    resolveYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?si=abc123XYZ"),
    "dQw4w9WgXcQ"
  );
  assert.equal(
    getVideoThumbnail("https://www.youtube.com/shorts/abcdefghijk"),
    "https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg"
  );
  assert.equal(
    getVideoThumbnail("https://m.youtube.com/watch?v=dQw4w9WgXcQ&feature=share"),
    "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
  );
});

test("extractTikTokCoverFromHtml: first cover, decode \\u002F, skip logos", () => {
  const html = `
    <script>window.__DATA__={"itemInfo":{"itemStruct":{
      "cover":"https:\\u002F\\u002Fp16-sign.tiktokcdn-us.com\\u002Fobj\\u002Ftos-useast5\\u002Freal-cover.webp",
      "originCover":"https:\\u002F\\u002Fexample.com\\u002Fother.webp"
    }}}</script>
  `;
  assert.equal(
    extractTikTokCoverFromHtml(html),
    "https://p16-sign.tiktokcdn-us.com/obj/tos-useast5/real-cover.webp"
  );

  const logoFirst = `
    {"cover":"https:\\u002F\\u002Fwww.tiktok.com\\u002Ftiktok-logo.png",
     "cover":"https:\\u002F\\u002Fp16.tiktokcdn.com\\u002Fobj\\u002Fgood.webp"}
  `;
  assert.equal(
    extractTikTokCoverFromHtml(logoFirst),
    "https://p16.tiktokcdn.com/obj/good.webp"
  );

  assert.equal(decodeJsonEscapedUrl("https:\\u002F\\u002Fa.com\\u002Fb"), "https://a.com/b");
});

test("extractOgImageFromHtml: Instagram-style meta", () => {
  const html = `<!DOCTYPE html><html><head>
    <meta property="og:image" content="https://scontent.cdninstagram.com/v/t51.2885-15/123_n.jpg?stp=dst-jpg" />
    <meta property="og:title" content="Post" />
  </head></html>`;
  assert.equal(
    extractOgImageFromHtml(html),
    "https://scontent.cdninstagram.com/v/t51.2885-15/123_n.jpg?stp=dst-jpg"
  );

  const reversed = `<meta content="https://fbcdn.net/v/cover.jpg" property="og:image" />`;
  assert.equal(extractOgImageFromHtml(reversed), "https://fbcdn.net/v/cover.jpg");

  assert.equal(
    extractOgImageFromHtml(`<meta property="og:image" content="https://x.com/static/images/logo.png" />`),
    null
  );
});

test("toDisplayThumbnailSrc proxies CDN hosts immediately", () => {
  assert.equal(isCdnThumbnailUrl("https://p16.tiktokcdn.com/obj/x.webp"), true);
  assert.equal(isCdnThumbnailUrl("https://scontent.cdninstagram.com/v/x.jpg"), true);
  assert.equal(isCdnThumbnailUrl("https://scontent-atl3-1.xx.fbcdn.net/v/x.jpg"), true);
  assert.equal(isCdnThumbnailUrl("https://img.youtube.com/vi/x/hqdefault.jpg"), false);

  const proxied = toDisplayThumbnailSrc("https://p16.tiktokcdn.com/obj/x.webp");
  assert.ok(proxied?.startsWith("/api/thumbnail-proxy?url="));
  assert.ok(proxied?.includes(encodeURIComponent("https://p16.tiktokcdn.com/obj/x.webp")));

  assert.equal(
    toDisplayThumbnailSrc("https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"),
    "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
  );
});
