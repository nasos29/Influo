import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSelfReportedCount,
  parseSocialPostUrl,
} from "../lib/socialPostUrl.ts";

test("parseSocialPostUrl accepts IG / TikTok / YouTube https URLs", () => {
  const ig = parseSocialPostUrl("https://www.instagram.com/reel/ABC123/");
  assert.equal(ig.ok, true);
  if (ig.ok) assert.equal(ig.provider, "instagram");

  const tt = parseSocialPostUrl("https://www.tiktok.com/@user/video/1234567890");
  assert.equal(tt.ok, true);
  if (tt.ok) assert.equal(tt.provider, "tiktok");

  const yt = parseSocialPostUrl("https://youtu.be/dQw4w9WgXcQ");
  assert.equal(yt.ok, true);
  if (yt.ok) assert.equal(yt.provider, "youtube");
});

test("parseSocialPostUrl rejects empty, http, and non-social hosts", () => {
  assert.deepEqual(parseSocialPostUrl(""), { ok: false, error: "empty" });
  assert.deepEqual(parseSocialPostUrl("http://instagram.com/p/x"), { ok: false, error: "invalid" });
  assert.deepEqual(parseSocialPostUrl("https://example.com/video"), { ok: false, error: "invalid" });
});

test("parseSelfReportedCount keeps non-negative integers only", () => {
  assert.equal(parseSelfReportedCount(null), null);
  assert.equal(parseSelfReportedCount(""), null);
  assert.equal(parseSelfReportedCount("-1"), null);
  assert.equal(parseSelfReportedCount("1,250"), 1250);
  assert.equal(parseSelfReportedCount(42.7), 43);
});
