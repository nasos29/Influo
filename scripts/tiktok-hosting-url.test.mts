import assert from "node:assert/strict";
import test from "node:test";

import {
  rewriteTikTokEmptyHandleUrl,
  tiktokUsernameFromAccounts,
} from "../lib/tiktokHostingUrl.ts";
import { hostableUrlsFromAccounts, isHostableCreatorMediaUrl } from "../lib/enqueueCreatorMediaJobs.ts";
import { portfolioLinkSourceKey } from "../lib/portfolioHosted.ts";
import { hostedMediaByNormalizedUrl, lookupHostedMedia } from "../lib/creatorMedia.ts";

test("tiktokUsernameFromAccounts picks TikTok handle", () => {
  assert.equal(
    tiktokUsernameFromAccounts([
      { platform: "Instagram", username: "ig" },
      { platform: "TikTok", username: "@demo_creator" },
    ]),
    "demo_creator"
  );
});

test("rewriteTikTokEmptyHandleUrl fixes @/photo and @/video", () => {
  const accounts = [{ platform: "tiktok", username: "nasos29" }];
  assert.equal(
    rewriteTikTokEmptyHandleUrl("https://www.tiktok.com/@/photo/7123456789012345678", accounts),
    "https://www.tiktok.com/@nasos29/photo/7123456789012345678"
  );
  assert.equal(
    rewriteTikTokEmptyHandleUrl("https://www.tiktok.com/@/video/7123456789012345678", accounts),
    "https://www.tiktok.com/@nasos29/video/7123456789012345678"
  );
  assert.equal(
    rewriteTikTokEmptyHandleUrl("https://www.tiktok.com/@nasos29/photo/1", accounts),
    "https://www.tiktok.com/@nasos29/photo/1"
  );
});

test("hostableUrlsFromAccounts returns display top-post IG/TT urls", () => {
  const accounts = [
    {
      platform: "tiktok",
      username: "a",
      top_posts: [
        { url: "https://www.tiktok.com/@a/video/1", type: "video", likes: 10, comments: 0, views: 100, posted_at: null },
        { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", type: "video", likes: 0, comments: 0, views: 1, posted_at: null },
      ],
    },
    {
      platform: "instagram",
      username: "b",
      top_posts: [
        { url: "https://www.instagram.com/p/abc/", type: "carousel", likes: 5, comments: 0, views: null, posted_at: null },
      ],
    },
  ];
  const urls = hostableUrlsFromAccounts(accounts);
  assert.ok(urls.includes("https://www.tiktok.com/@a/video/1"));
  assert.ok(urls.includes("https://www.instagram.com/p/abc/"));
  assert.equal(urls.some((u) => u.includes("youtube")), false);
});

test("isHostableCreatorMediaUrl allows vm.tiktok short links", () => {
  assert.equal(isHostableCreatorMediaUrl("https://vm.tiktok.com/ZMexample/"), true);
  assert.equal(isHostableCreatorMediaUrl("https://www.youtube.com/watch?v=x"), false);
});

test("lookupHostedMedia prefers ready hosted row by normalized URL", () => {
  const map = hostedMediaByNormalizedUrl([
    {
      sourceUrl: "https://www.instagram.com/p/AbCd/",
      kind: "collab",
      folderPath: "creators/x/collabs/1-post/",
      mediaType: "video",
      playUrl: "https://media.example/creators/x/collabs/1-post/video.mp4",
      av1Url: null,
      hevcUrl: null,
      posterUrl: "https://media.example/creators/x/collabs/1-post/poster.webp",
      carouselUrls: null,
      durationMs: 1000,
      width: 720,
      height: 1280,
    },
  ]);
  const hit = lookupHostedMedia(map, "https://www.instagram.com/p/AbCd/?utm=1");
  assert.ok(hit);
  assert.equal(hit.playUrl.includes("video.mp4"), true);
});

test("portfolio source key stable for rewritten tiktok photo", () => {
  const fixed = "https://www.tiktok.com/@user/photo/123";
  assert.equal(portfolioLinkSourceKey(fixed), "tiktok.com/@user/photo/123");
});