import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalInstagramMediaUrl,
  isAllowedInstagramHostname,
  isInstagramShareUrl,
  normalizeInstagramMediaUrl,
  resolveInstagramShareUrl,
} from "../lib/resolveInstagramShareUrl.ts";
import { isEmbeddableVideoUrl } from "../lib/videoThumbnail.ts";
import { parseSocialPostUrl, parseSocialPostUrlResolved } from "../lib/socialPostUrl.ts";

const REEL_SHORTCODE = "ABCdef12";
const CANONICAL = canonicalInstagramMediaUrl("reel", REEL_SHORTCODE);

function mockFetchRedirect(
  redirectUrl: string,
  finalStatus = 200
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const reqUrl = String(input);
    if (init?.redirect === "manual") {
      return new Response(null, {
        status: 302,
        headers: { location: redirectUrl },
      });
    }
    return new Response(`<html><meta property="og:url" content="${CANONICAL}"></html>`, {
      status: finalStatus,
      headers: { "content-type": "text/html" },
    });
  };
}

test("isInstagramShareUrl accepts /share/<token> and /share/reel/<token>", () => {
  assert.equal(
    isInstagramShareUrl("https://www.instagram.com/share/BAB0gQW35h"),
    true
  );
  assert.equal(
    isInstagramShareUrl("https://www.instagram.com/share/reel/BAB0gQW35h"),
    true
  );
  assert.equal(
    isInstagramShareUrl("https://m.instagram.com/share/p/AbCdEfGhIjK/"),
    true
  );
  assert.equal(isInstagramShareUrl("http://www.instagram.com/share/x"), false);
  assert.equal(isInstagramShareUrl("https://evil.com/share/x"), false);
  assert.equal(isInstagramShareUrl("https://www.instagram.com/reel/AbC/"), false);
});

test("isAllowedInstagramHostname rejects off-platform redirect targets", () => {
  assert.equal(isAllowedInstagramHostname("www.instagram.com"), true);
  assert.equal(isAllowedInstagramHostname("m.instagram.com"), true);
  assert.equal(isAllowedInstagramHostname("evil.com"), false);
  assert.equal(isAllowedInstagramHostname("instagram.com.evil.com"), false);
});

test("normalizeInstagramMediaUrl strips query params", () => {
  assert.equal(
    normalizeInstagramMediaUrl(
      "https://www.instagram.com/reel/AbCdEfGhIjK/?utm_source=ig_share"
    ),
    "https://www.instagram.com/reel/AbCdEfGhIjK/"
  );
});

test("resolveInstagramShareUrl follows Instagram redirects (mocked)", async () => {
  const fetchImpl = mockFetchRedirect(CANONICAL);
  const share = "https://www.instagram.com/share/BAB0gQW35h";
  const result = await resolveInstagramShareUrl(share, fetchImpl);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.url, CANONICAL);
    assert.equal(result.media.code, REEL_SHORTCODE);
  }
});

test("resolveInstagramShareUrl blocks SSRF redirect to non-Instagram host", async () => {
  const fetchImpl: typeof fetch = async (_input, init) => {
    if (init?.redirect === "manual") {
      return new Response(null, {
        status: 302,
        headers: { location: "https://evil.com/steal" },
      });
    }
    return new Response("ok", { status: 200 });
  };
  const result = await resolveInstagramShareUrl(
    "https://www.instagram.com/share/AbCdEfGhIjK",
    fetchImpl
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "redirect_blocked_ssrf");
});

test("client isEmbeddableVideoUrl accepts share links", () => {
  assert.equal(
    isEmbeddableVideoUrl("https://www.instagram.com/share/BAB0gQW35h"),
    true
  );
});

test("parseSocialPostUrl accepts share links before server resolve", () => {
  const parsed = parseSocialPostUrl("https://www.instagram.com/share/BAB0gQW35h");
  assert.equal(parsed.ok, true);
});

test("parseSocialPostUrlResolved canonicalizes share links", async () => {
  const fetchImpl = mockFetchRedirect(CANONICAL);
  const parsed = await parseSocialPostUrlResolved(
    "https://www.instagram.com/share/BAB0gQW35h",
    fetchImpl
  );
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.url, CANONICAL);
    assert.equal(parsed.provider, "instagram");
  }
});

test("parseSocialPostUrlResolved rejects unresolvable share links", async () => {
  const fetchImpl: typeof fetch = async () => {
    return new Response("nope", { status: 404 });
  };
  const parsed = await parseSocialPostUrlResolved(
    "https://www.instagram.com/share/BAB0gQW35h",
    fetchImpl
  );
  assert.equal(parsed.ok, false);
});