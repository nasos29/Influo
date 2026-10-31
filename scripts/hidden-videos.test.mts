// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/hidden-videos.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  countHiddenVideos,
  parseHiddenVideos,
  removeHiddenVideo,
  syncHiddenVideosWithVideos,
  upsertHiddenVideo,
  visibleVideos,
} from "../lib/hiddenVideos.ts";

test("visibleVideos filters hidden URLs by normalized key", () => {
  const videos = [
    "https://www.instagram.com/reel/AAA/",
    "https://www.tiktok.com/@u/video/1",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  ];
  const hidden = [
    {
      url: "https://www.tiktok.com/@u/video/1?utm=1",
      reason: "tiktok_oembed_404",
      hidden_at: "2026-01-01T00:00:00.000Z",
    },
  ];
  assert.deepEqual(visibleVideos(videos, hidden), [
    "https://www.instagram.com/reel/AAA/",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  ]);
});

test("syncHiddenVideosWithVideos drops orphans; upsert/remove", () => {
  const hidden = parseHiddenVideos([
    {
      url: "https://www.tiktok.com/@u/video/1",
      reason: "x",
      hidden_at: "2026-01-01T00:00:00.000Z",
    },
    {
      url: "https://www.tiktok.com/@u/video/2",
      reason: "y",
      hidden_at: "2026-01-02T00:00:00.000Z",
    },
  ]);
  assert.equal(countHiddenVideos(hidden), 2);
  const synced = syncHiddenVideosWithVideos(
    ["https://www.tiktok.com/@u/video/1"],
    hidden
  );
  assert.equal(synced.length, 1);
  assert.equal(synced[0]!.url, "https://www.tiktok.com/@u/video/1");

  const withNew = upsertHiddenVideo(synced, {
    url: "https://www.instagram.com/reel/BBB/",
    reason: "instagram_no_video_url",
    hidden_at: "2026-01-03T00:00:00.000Z",
  });
  assert.equal(withNew.length, 2);
  assert.equal(removeHiddenVideo(withNew, "https://www.instagram.com/reel/BBB/?x=1").length, 1);
});
