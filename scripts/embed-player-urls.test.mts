// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/embed-player-urls.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTikTokEmbedUrl,
  buildTikTokPlayerUrl,
  extractTikTokVideoId,
  isTikTokPlayerIframeSrc,
  isTikTokShortLink,
  preferTikTokEmbedPlayerFromUA,
  TIKTOK_EMBED_IFRAME_SANDBOX,
  TIKTOK_IFRAME_ALLOW,
  tikTokEmbedIframeSandboxFromUA,
} from "../lib/tikTokPlayer.ts";
import { tikTokIframeScaleStyle, TIKTOK_PLAYER_MIN_IFRAME_WIDTH } from "../lib/useTikTokIframeScale.ts";
import {
  isFatalTikTokPlayerError,
  isRetryableTikTokPlayerError,
  isTikTokPlayerReadyEvent,
  TIKTOK_SOUND_PROMPT_MS,
} from "../lib/useTikTokPlayerHost.ts";
import {
  isTikTokPlayerOverloadError,
  shouldFallbackToTikTokEmbed,
  shouldUnloadTikTokPlayer,
  TIKTOK_PLAYER_ERROR,
} from "../lib/tikTokPlayerErrors.ts";
import {
  claimTikTokPlayerSession,
  releaseAllTikTokPlayerSessions,
  TIKTOK_PLAYER_SESSION_EVENT,
  type TikTokPlayerSessionDetail,
} from "../lib/tikTokPlayerSession.ts";
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
    "https://www.tiktok.com/player/v1/7123456789012345678?autoplay=1&muted=1&controls=1&description=0&music_info=0&rel=0&embed_from=oembed"
  );
  const unmuted = buildTikTokPlayerUrl("7123456789012345678", { muted: false });
  assert.match(unmuted, /muted=0/);
  assert.match(unmuted, /autoplay=1/);
  assert.throws(() => buildTikTokPlayerUrl("not-a-number"));
});

test("buildTikTokEmbedUrl points at embed/v2", () => {
  assert.equal(
    buildTikTokEmbedUrl("7123456789012345678"),
    "https://www.tiktok.com/embed/v2/7123456789012345678"
  );
  assert.equal(
    isTikTokPlayerIframeSrc(buildTikTokEmbedUrl("7123456789012345678")),
    true
  );
  assert.throws(() => buildTikTokEmbedUrl("not-a-number"));
});

test("TikTok embed/v2 sandbox allows playback tokens but not off-site navigation", () => {
  const tokens = TIKTOK_EMBED_IFRAME_SANDBOX.split(/\s+/);
  for (const need of ["allow-scripts", "allow-same-origin", "allow-presentation"]) {
    assert.ok(tokens.includes(need), need);
  }
  assert.equal(tokens.includes("allow-popups"), false);
  assert.equal(tokens.includes("allow-popups-to-escape-sandbox"), false);
  assert.equal(tokens.includes("allow-top-navigation"), false);
  assert.equal(tokens.includes("allow-top-navigation-by-user-activation"), false);
});

test("TikTok iframe allow tokens and desktop-only embed sandbox", () => {
  for (const need of [
    "accelerometer",
    "autoplay",
    "clipboard-write",
    "encrypted-media",
    "fullscreen",
    "gyroscope",
    "picture-in-picture",
    "web-share",
    "storage-access",
  ]) {
    assert.ok(TIKTOK_IFRAME_ALLOW.includes(need), need);
  }
  const mobileChrome =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
  const desktopChrome =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  const mobileFirefox =
    "Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0";
  assert.equal(tikTokEmbedIframeSandboxFromUA(mobileChrome), undefined);
  assert.equal(tikTokEmbedIframeSandboxFromUA(desktopChrome), TIKTOK_EMBED_IFRAME_SANDBOX);
  assert.equal(tikTokEmbedIframeSandboxFromUA(mobileFirefox), TIKTOK_EMBED_IFRAME_SANDBOX);
});

test("preferTikTokEmbedPlayerFromUA is true only for mobile Chromium, not Firefox or desktop", () => {
  assert.equal(
    preferTikTokEmbedPlayerFromUA(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
    ),
    true
  );
  assert.equal(
    preferTikTokEmbedPlayerFromUA(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.0.0 Mobile/15E148 Safari/604.1"
    ),
    true
  );
  assert.equal(
    preferTikTokEmbedPlayerFromUA(
      "Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0"
    ),
    false
  );
  assert.equal(
    preferTikTokEmbedPlayerFromUA(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    false
  );
});

test("isTikTokPlayerMessage and postTikTokPlayer shape", async () => {
  const { isTikTokPlayerMessage, postTikTokPlayer, TIKTOK_PLAYER_ORIGIN } =
    await import("../lib/tikTokPlayer.ts");
  assert.equal(TIKTOK_PLAYER_ORIGIN, "https://www.tiktok.com");
  assert.equal(isTikTokPlayerMessage({ "x-tiktok-player": true, type: "unMute" }), true);
  assert.equal(isTikTokPlayerMessage({ type: "unMute" }), false);
  assert.equal(isTikTokPlayerMessage(null), false);

  const posted: unknown[] = [];
  assert.equal(isTikTokPlayerIframeSrc("about:blank"), false);
  assert.equal(
    isTikTokPlayerIframeSrc(
      "https://www.tiktok.com/player/v1/7123456789012345678?autoplay=1"
    ),
    true
  );

  const playerSrc = buildTikTokPlayerUrl("7123456789012345678");
  const fakeIframe = {
    src: playerSrc,
    getAttribute(name: string) {
      return name === "src" ? playerSrc : null;
    },
    contentWindow: {
      postMessage(data: unknown, origin: string) {
        posted.push({ data, origin });
      },
    },
  } as unknown as HTMLIFrameElement;
  postTikTokPlayer(fakeIframe, "unMute");
  postTikTokPlayer(fakeIframe, "seekTo", 12);
  postTikTokPlayer(null, "play");
  assert.deepEqual(posted, [
    { data: { "x-tiktok-player": true, type: "unMute" }, origin: TIKTOK_PLAYER_ORIGIN },
    {
      data: { "x-tiktok-player": true, type: "seekTo", value: 12 },
      origin: TIKTOK_PLAYER_ORIGIN,
    },
  ]);
  postTikTokPlayer(
    { contentWindow: fakeIframe.contentWindow, src: "about:blank", getAttribute: () => "about:blank" } as unknown as HTMLIFrameElement,
    "play"
  );
  assert.equal(posted.length, 2);
});

test("tikTokIframeScaleStyle scales narrow boxes to 325px and fills the cover height", () => {
  assert.equal(tikTokIframeScaleStyle(TIKTOK_PLAYER_MIN_IFRAME_WIDTH, 400), undefined);
  assert.equal(tikTokIframeScaleStyle(0, 200), undefined);
  const boxW = 170;
  const boxH = 255;
  const narrow = tikTokIframeScaleStyle(boxW, boxH);
  assert.ok(narrow);
  const scale = boxW / TIKTOK_PLAYER_MIN_IFRAME_WIDTH;
  assert.equal(narrow!.width, TIKTOK_PLAYER_MIN_IFRAME_WIDTH);
  assert.equal(narrow!.height, boxH / scale);
  assert.equal(narrow!.transformOrigin, "top left");
  assert.match(String(narrow!.transform), /scale\(0\.523/);
  // After CSS scale, the visual size must equal the cover box exactly.
  assert.equal(Number(narrow!.width) * scale, boxW);
  assert.equal(Number(narrow!.height) * scale, boxH);
  const typicalColumn = tikTokIframeScaleStyle(160, 240);
  assert.ok(typicalColumn);
  assert.match(String(typicalColumn!.transform), /scale\(0\.492/);
  const typicalScale = 160 / TIKTOK_PLAYER_MIN_IFRAME_WIDTH;
  assert.equal(Number(typicalColumn!.height) * typicalScale, 240);
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

test("TikTok 1001/1002 are fatal; nothing is auto-retried; 3002 is not a load error", () => {
  assert.equal(isFatalTikTokPlayerError({ errorCode: 1001, errorType: "INVALID_VIDEO" }), true);
  assert.equal(isFatalTikTokPlayerError({ errorCode: 1001 }), true);
  assert.equal(isFatalTikTokPlayerError(1001), true);
  assert.equal(isFatalTikTokPlayerError({ errorCode: 1002, errorType: "VIDEO_EMBED_BANNED" }), true);
  assert.equal(isFatalTikTokPlayerError({ errorCode: 3001 }), false);
  assert.equal(isRetryableTikTokPlayerError(3001), false);
  assert.equal(isRetryableTikTokPlayerError(3002), false);
  assert.equal(isRetryableTikTokPlayerError(1001), false);
  assert.equal(isRetryableTikTokPlayerError(2005), false);

  assert.equal(isTikTokPlayerOverloadError({ errorCode: 2005, errorType: "TOO_MANY_REQUESTS" }), true);
  assert.equal(isTikTokPlayerOverloadError({ errorCode: 2001, errorType: "SERVER_ERROR" }), true);
  assert.equal(isTikTokPlayerOverloadError(3001), false);

  assert.equal(shouldUnloadTikTokPlayer({ errorCode: 2005 }, false), true);
  assert.equal(shouldUnloadTikTokPlayer({ errorCode: 2001 }, false), true);
  assert.equal(shouldUnloadTikTokPlayer({ errorCode: TIKTOK_PLAYER_ERROR.PLAYER_SDK_ERROR }, false), false);
  assert.equal(shouldUnloadTikTokPlayer({ errorCode: 3001 }, false), false);
  assert.equal(shouldUnloadTikTokPlayer({ errorCode: 3001 }, true), false);
  assert.equal(shouldUnloadTikTokPlayer({ errorCode: 3002 }, true), false);
  assert.equal(shouldUnloadTikTokPlayer({ errorCode: 1001, errorType: "INVALID_VIDEO" }, true), false);

  assert.equal(shouldFallbackToTikTokEmbed({ errorCode: 3001 }, false), true);
  assert.equal(shouldFallbackToTikTokEmbed({ errorCode: 3001, errorType: "PLAYBACK_ERROR" }, true), true);
  assert.equal(shouldFallbackToTikTokEmbed({ errorCode: 1004, errorType: "PLAYER_SDK_ERROR" }, false), true);
  assert.equal(shouldFallbackToTikTokEmbed({ errorCode: 2005, errorType: "TOO_MANY_REQUESTS" }, false), true);
  assert.equal(shouldFallbackToTikTokEmbed({ errorCode: 2001, errorType: "SERVER_ERROR" }, true), true);
  assert.equal(shouldFallbackToTikTokEmbed({ errorCode: 3002 }, true), false);
  assert.equal(shouldFallbackToTikTokEmbed({ errorCode: 1001, errorType: "INVALID_VIDEO" }, true), false);
});

test("claimTikTokPlayerSession notifies other cards to unload", () => {
  const target = new EventTarget();
  const previous = (globalThis as { window?: EventTarget }).window;
  (globalThis as { window?: EventTarget }).window = target;
  const seen: Array<string | null> = [];
  const onClaim = (event: Event) => {
    const detail = (event as CustomEvent<TikTokPlayerSessionDetail>).detail;
    seen.push(detail?.id ?? null);
  };
  target.addEventListener(TIKTOK_PLAYER_SESSION_EVENT, onClaim);
  try {
    claimTikTokPlayerSession("card-a");
    claimTikTokPlayerSession("card-b");
    releaseAllTikTokPlayerSessions();
  } finally {
    target.removeEventListener(TIKTOK_PLAYER_SESSION_EVENT, onClaim);
    if (previous === undefined) {
      delete (globalThis as { window?: EventTarget }).window;
    } else {
      (globalThis as { window?: EventTarget }).window = previous;
    }
  }
  assert.deepEqual(seen, ["card-a", "card-b", null]);
});

test("host commands wait for onPlayerReady and do not treat onStateChange as ready", () => {
  assert.equal(isTikTokPlayerReadyEvent("onPlayerReady"), true);
  assert.equal(isTikTokPlayerReadyEvent("onStateChange"), false);
  assert.equal(isTikTokPlayerReadyEvent("onLoad"), false);
  assert.equal(isTikTokPlayerReadyEvent("onMute"), false);
  assert.ok(TIKTOK_SOUND_PROMPT_MS >= 4000);
});
