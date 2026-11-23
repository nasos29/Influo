import assert from "node:assert/strict";
import test from "node:test";
import {
  creatorIgTikTokHostedOnly,
  IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE_ISO,
  igTikTokHostedOnlyApprovedSinceMs,
} from "../lib/creatorMediaEmbedPolicy.ts";
import { toPublicProfile } from "../lib/publicInfluencer.ts";

test("IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE env overrides default cutoff", () => {
  const custom = "2027-01-01T00:00:00.000Z";
  assert.equal(
    igTikTokHostedOnlyApprovedSinceMs({ IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE: custom }),
    Date.parse(custom)
  );
  assert.equal(creatorIgTikTokHostedOnly("2026-12-01T00:00:00.000Z", { IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE: custom }), false);
  assert.equal(creatorIgTikTokHostedOnly(custom, { IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE: custom }), true);
});

test("hosted-only cutoff respects approved_at", () => {
  const since = IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE_ISO;
  assert.equal(creatorIgTikTokHostedOnly(null), false);
  assert.equal(creatorIgTikTokHostedOnly("2026-11-20T12:00:00.000Z"), false);
  assert.equal(creatorIgTikTokHostedOnly(since), true);
  assert.equal(creatorIgTikTokHostedOnly("2026-12-01T00:00:00.000Z"), true);
});

test("toPublicProfile exposes ig_tiktok_hosted_only without approved_at", () => {
  const row = {
    id: "11111111-2222-3333-4444-555555555555",
    display_name: "Test",
    approved: true,
    approved_at: IG_TIKTOK_HOSTED_ONLY_APPROVED_SINCE_ISO,
    accounts: [],
    videos: [],
  };
  const pub = toPublicProfile(row);
  assert.equal(pub.ig_tiktok_hosted_only, true);
  assert.equal("approved_at" in pub, false);
});