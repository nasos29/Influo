import assert from "node:assert/strict";
import test from "node:test";
import {
  creatorIgTikTokHostedOnly,
  IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE_ISO,
  igTikTokHostedOnlyApprovedSinceMs,
} from "../lib/creatorMediaEmbedPolicy.ts";
import { toPublicProfile } from "../lib/publicInfluencer.ts";
import { hostedOnlyPortfolioCell } from "../lib/hostedOnlyPortfolioCell.ts";
import { filterTopPostsForHostedOnly } from "../lib/topPostsHostedOnly.ts";
import { portfolioMediaWorkerArgv } from "../lib/triggerPortfolioMediaWorker.ts";
import { hostedMediaByNormalizedUrl, type HostedMedia } from "../lib/creatorMedia.ts";

test("default cutoff is 23 Nov 2026 00:00 Europe/Athens", () => {
  assert.equal(IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE_ISO, "2026-11-22T22:00:00.000Z");
});

test("IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE env overrides default cutoff", () => {
  const custom = "2027-01-01T00:00:00.000Z";
  assert.equal(
    igTikTokHostedOnlyApprovedSinceMs({ IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE: custom }),
    Date.parse(custom)
  );
  assert.equal(
    creatorIgTikTokHostedOnly(
      { approvedAt: "2026-12-01T00:00:00.000Z" },
      { IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE: custom }
    ),
    false
  );
  assert.equal(
    creatorIgTikTokHostedOnly({ approvedAt: custom }, { IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE: custom }),
    true
  );
});

test("hosted-only uses created_at OR approved_at on/after cutoff", () => {
  const since = IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE_ISO;
  assert.equal(creatorIgTikTokHostedOnly({}), false);
  assert.equal(creatorIgTikTokHostedOnly({ createdAt: null, approvedAt: null }), false);
  assert.equal(creatorIgTikTokHostedOnly({ createdAt: "2026-11-20T12:00:00.000Z" }), false);
  assert.equal(creatorIgTikTokHostedOnly({ approvedAt: since }), true);
  assert.equal(creatorIgTikTokHostedOnly({ createdAt: since, approvedAt: null }), true);
  assert.equal(creatorIgTikTokHostedOnly({ createdAt: since }), true);
  assert.equal(creatorIgTikTokHostedOnly({ createdAt: "invalid", approvedAt: since }), true);
});

test("toPublicProfile exposes ig_tiktok_hosted_only without approved_at", () => {
  const row = {
    id: "11111111-2222-3333-4444-555555555555",
    display_name: "Test",
    approved: true,
    created_at: IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE_ISO,
    approved_at: null,
    accounts: [],
    videos: [],
  };
  const pub = toPublicProfile(row);
  assert.equal(pub.ig_tiktok_hosted_only, true);
  assert.equal("approved_at" in pub, false);
});

test("hosted-only top posts drop unhosted IG/TikTok, keep YouTube", () => {
  const ig = "https://www.instagram.com/reel/abc/";
  const tt = "https://www.tiktok.com/@a/video/1";
  const yt = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  const posts = [
    { url: ig, platform: "instagram", type: "video" as const },
    { url: tt, platform: "tiktok", type: "video" as const },
    { url: yt, platform: "youtube", type: "video" as const },
  ];
  const hosted = hostedMediaByNormalizedUrl([
    {
      sourceUrl: ig,
      playUrl: "https://media.example/x.mp4",
      kind: "top_post",
    } as HostedMedia,
  ]);
  const filtered = filterTopPostsForHostedOnly(posts, hosted, true);
  assert.deepEqual(
    filtered.map((p) => p.url),
    [ig, yt]
  );
});

test("hosted-only portfolio cell hides failed link jobs", () => {
  assert.equal(
    hostedOnlyPortfolioCell({
      igTikTokHostedOnly: true,
      provider: "tiktok",
      hasHostedMedia: false,
      linkPhase: "failed",
    }),
    "hide"
  );
  assert.equal(
    hostedOnlyPortfolioCell({
      igTikTokHostedOnly: true,
      provider: "instagram",
      hasHostedMedia: false,
      linkPhase: "pending",
    }),
    "pending"
  );
});

test("worker trigger argv: uploads-only vs links-only", () => {
  const uploads = portfolioMediaWorkerArgv("uploads-only");
  const links = portfolioMediaWorkerArgv("links-only");
  assert.ok(uploads[0].endsWith("process_creator_media_jobs.py"));
  assert.ok(links[0].endsWith("process_creator_media_jobs.py"));
  assert.equal(uploads[uploads.length - 1], "--uploads-only");
  assert.equal(links[links.length - 1], "--links-only");
});