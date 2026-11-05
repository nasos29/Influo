import assert from "node:assert/strict";
import test from "node:test";
import {
  formatFollowerCompact,
  normalizeFollowersForStorage,
  parseFollowerString,
} from "../lib/parseFollowers.ts";

test("formatFollowerCompact keeps 60k and 1.33k", () => {
  assert.equal(formatFollowerCompact(60000), "60k");
  assert.equal(formatFollowerCompact(1330), "1.33k");
  assert.equal(formatFollowerCompact(23100), "23.1k");
  assert.equal(formatFollowerCompact(1500000), "1.5M");
});

test("normalizeFollowersForStorage turns exact ints into compact k for display", () => {
  assert.equal(normalizeFollowersForStorage(60000), "60k");
  assert.equal(normalizeFollowersForStorage("60000"), "60k");
  assert.equal(normalizeFollowersForStorage("60k"), "60k");
  assert.equal(parseFollowerString("60000"), 60000);
  assert.equal(parseFollowerString(normalizeFollowersForStorage(60000)), 60000);
});
