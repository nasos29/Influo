import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getSignedUrlExpiryMs, isSignedUrlStale } from "../lib/signedCdnExpiry.ts";

describe("getSignedUrlExpiryMs", () => {
  test("parses TikTok x-expires (unix seconds)", () => {
    const exp = 1_900_000_000;
    const url = `https://p16.tiktokcdn.com/obj/cover.webp?x-expires=${exp}&x-signature=abc`;
    assert.equal(getSignedUrlExpiryMs(url), exp * 1000);
  });

  test("parses Instagram oe (hex unix seconds)", () => {
    const exp = 0x71c2c980; // sample hex
    const hex = exp.toString(16);
    const url = `https://scontent.cdninstagram.com/v/t51.2885-15/x.jpg?oe=${hex}&oh=xx`;
    assert.equal(getSignedUrlExpiryMs(url), exp * 1000);
  });

  test("returns null when no signed params", () => {
    assert.equal(getSignedUrlExpiryMs("https://img.youtube.com/vi/x/hqdefault.jpg"), null);
  });

  test("isSignedUrlStale within 1h skew", () => {
    const soon = Math.floor(Date.now() / 1000) + 30 * 60; // 30 min
    const url = `https://p16.tiktokcdn.com/x.webp?x-expires=${soon}`;
    assert.equal(isSignedUrlStale(url), true);
  });

  test("isSignedUrlStale false when far future", () => {
    const later = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    const url = `https://p16.tiktokcdn.com/x.webp?x-expires=${later}`;
    assert.equal(isSignedUrlStale(url), false);
  });
});
