import assert from "node:assert/strict";
import test from "node:test";
import {
  formatFollowerCompact,
  normalizeFollowersForStorage,
  parseFollowerString,
} from "../lib/parseFollowers.ts";

test("formatFollowerCompact uses el-GR thousands grouping", () => {
  assert.equal(formatFollowerCompact(950), "950");
  assert.equal(formatFollowerCompact(1449), "1.449");
  assert.equal(formatFollowerCompact(30937), "30.937");
  assert.equal(formatFollowerCompact(1234567), "1.234.567");
  assert.equal(formatFollowerCompact(60000), "60.000");
});

test("normalizeFollowersForStorage keeps plain integer strings", () => {
  assert.equal(normalizeFollowersForStorage(60000), "60000");
  assert.equal(normalizeFollowersForStorage("60000"), "60000");
  assert.equal(normalizeFollowersForStorage("60k"), "60000");
  assert.equal(parseFollowerString("60000"), 60000);
  assert.equal(parseFollowerString(normalizeFollowersForStorage(60000)), 60000);
});

test("parseFollowerString accepts legacy formats", () => {
  assert.equal(parseFollowerString("30.9k"), 30900);
  assert.equal(parseFollowerString("1.5K"), 1500);
  assert.equal(parseFollowerString("11,8k"), 11800);
  assert.equal(parseFollowerString("2,5 εκ."), 2_500_000);
  assert.equal(parseFollowerString("1.2M"), 1_200_000);
  assert.equal(parseFollowerString("14.600"), 14600);
  assert.equal(parseFollowerString("1,449"), 1449);
  assert.equal(parseFollowerString("1449"), 1449);
});