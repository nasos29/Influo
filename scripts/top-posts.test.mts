// node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs --test scripts/top-posts.test.mts
import assert from "node:assert/strict";
import test from "node:test";
import {
  collectTopPosts,
  formatCompactCount,
  isAllowedTopPostUrl,
  sanitizeTopPosts,
} from "../lib/topPosts.ts";

test("isAllowedTopPostUrl accepts https IG/TT/YT only", () => {
  assert.equal(isAllowedTopPostUrl("https://www.instagram.com/reel/AbC123xyz/"), true);
  assert.equal(isAllowedTopPostUrl("https://www.tiktok.com/@u/video/7123456789012345678"), true);
  assert.equal(isAllowedTopPostUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), true);
  assert.equal(isAllowedTopPostUrl("https://m.youtube.com/shorts/abcdefghijk"), true);
  assert.equal(isAllowedTopPostUrl("http://www.instagram.com/reel/AbC123xyz/"), false);
  assert.equal(isAllowedTopPostUrl("https://evil.com/instagram.com/x"), false);
  assert.equal(isAllowedTopPostUrl("not-a-url"), false);
});

test("sanitizeTopPosts keeps only safe fields and valid types", () => {
  const cleaned = sanitizeTopPosts([
    {
      url: "https://www.instagram.com/p/Photo1/",
      type: "image",
      likes: 1200,
      comments: 10,
      views: null,
      posted_at: "2024-06-01T12:00:00Z",
      thumbnail: "https://cdn.example/x.jpg",
      caption: "drop me",
    },
    {
      url: "https://evil.com/x",
      type: "video",
      likes: 99999,
    },
    {
      url: "https://www.tiktok.com/@u/video/1",
      type: "unknown",
      likes: 5,
    },
    {
      url: "https://www.tiktok.com/@u/photo/2",
      type: "carousel",
      likes: "50",
      comments: "3",
      views: 0,
    },
  ]);
  assert.equal(cleaned.length, 2);
  assert.deepEqual(cleaned[0], {
    url: "https://www.instagram.com/p/Photo1/",
    type: "image",
    likes: 1200,
    comments: 10,
    views: null,
    posted_at: "2024-06-01T12:00:00.000Z",
  });
  assert.equal(cleaned[1]?.type, "carousel");
  assert.equal(cleaned[1]?.likes, 50);
});

test("collectTopPosts sorts by views then likes+comments and caps at limit", () => {
  const accounts = [
    {
      platform: "Instagram",
      top_posts: [
        {
          url: "https://www.instagram.com/reel/LowViews/",
          type: "video",
          likes: 9000,
          comments: 100,
          views: 100,
        },
        {
          url: "https://www.instagram.com/p/NoViewsHighEng/",
          type: "image",
          likes: 5000,
          comments: 500,
          views: null,
        },
      ],
    },
    {
      platform: "TikTok",
      top_posts: [
        {
          url: "https://www.tiktok.com/@u/video/HighViews",
          type: "video",
          likes: 10,
          comments: 1,
          views: 500000,
        },
        {
          url: "https://www.tiktok.com/@u/photo/Mid",
          type: "image",
          likes: 100,
          comments: 0,
          views: 2000,
        },
      ],
    },
  ];

  const top = collectTopPosts(accounts, 3);
  assert.equal(top.length, 3);
  assert.deepEqual(
    top.map((p) => p.url),
    [
      "https://www.tiktok.com/@u/video/HighViews",
      "https://www.tiktok.com/@u/photo/Mid",
      "https://www.instagram.com/reel/LowViews/",
    ]
  );
  assert.equal(top[0]?.platform, "TikTok");

  // Posts with no views sort by likes+comments among themselves after viewed ones
  const noViewSort = collectTopPosts(
    [
      {
        platform: "Instagram",
        top_posts: [
          {
            url: "https://www.instagram.com/p/A/",
            type: "image",
            likes: 10,
            comments: 1,
            views: null,
          },
          {
            url: "https://www.instagram.com/p/B/",
            type: "image",
            likes: 100,
            comments: 20,
            views: null,
          },
        ],
      },
    ],
    6
  );
  assert.deepEqual(
    noViewSort.map((p) => p.url),
    ["https://www.instagram.com/p/B/", "https://www.instagram.com/p/A/"]
  );
});

test("collectTopPosts returns empty when no posts", () => {
  assert.deepEqual(collectTopPosts(null), []);
  assert.deepEqual(collectTopPosts([]), []);
  assert.deepEqual(collectTopPosts([{ platform: "Instagram" }]), []);
});

test("formatCompactCount abbreviates", () => {
  assert.equal(formatCompactCount(12500), "12.5K");
  assert.equal(formatCompactCount(1000), "1K");
  assert.equal(formatCompactCount(999), "999");
  assert.equal(formatCompactCount(null), "—");
});
