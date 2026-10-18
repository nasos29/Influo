import assert from "node:assert/strict";
import test from "node:test";
import { canonicalPlatform, formatFollowerCount, parseFollowerNumber, statsFromAccounts } from "../lib/platformStats.ts";

test("platform aliases collapse to one network", () => {
  assert.equal(canonicalPlatform("IG"), "instagram");
  assert.equal(canonicalPlatform("Instagram"), "instagram");
  assert.equal(canonicalPlatform("TT"), "tiktok");
});

test("duplicate instagram rows keep one entry and the total does not double count", () => {
  const stats = statsFromAccounts([
    { platform: "TikTok", followers: "62.8k" },
    { platform: "Instagram", followers: "10k", username: "older" },
    { platform: "IG", followers: "6.1k", username: "newer" },
  ]);
  assert.deepEqual(
    stats.map((row) => row.platform),
    ["tiktok", "instagram"]
  );
  const instagram = stats.find((row) => row.platform === "instagram");
  assert.equal(instagram?.followers, "6.1k");
  const total = stats.reduce((sum, row) => sum + parseFollowerNumber(row.followers), 0);
  assert.equal(formatFollowerCount(total), "68.9k");
});

test("a verified account wins over a later duplicate", () => {
  const stats = statsFromAccounts([
    { platform: "instagram", followers: "6.1k" },
    { platform: "Instagram", followers: "10k", verified: true, updated_at: "2020-01-01T00:00:00.000Z" },
  ]);
  assert.equal(stats.length, 1);
  assert.equal(stats[0]?.followers, "10k");
});
