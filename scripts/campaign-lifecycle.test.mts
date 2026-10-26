import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignClosesAt,
  daysUntilCampaignCloses,
  normalizeDeadlineForOpen,
  CAMPAIGN_DEFAULT_DAYS,
} from "../lib/campaignLifecycle.ts";

test("normalizeDeadlineForOpen: past deadline clears for open", () => {
  const now = new Date("2026-10-26T15:00:00.000Z");
  const past = "2026-10-20T12:00:00.000Z";
  const result = normalizeDeadlineForOpen(past, now);
  assert.equal(result.deadline, null);
  assert.equal(result.clearedPastDeadline, true);
});

test("normalizeDeadlineForOpen: today noon before afternoon now clears", () => {
  const now = new Date("2026-10-26T15:00:00.000Z");
  const todayNoon = "2026-10-26T12:00:00.000Z";
  const result = normalizeDeadlineForOpen(todayNoon, now);
  assert.equal(result.deadline, null);
  assert.equal(result.clearedPastDeadline, true);
});

test("normalizeDeadlineForOpen: future deadline kept", () => {
  const now = new Date("2026-10-26T15:00:00.000Z");
  const future = "2026-11-10T12:00:00.000Z";
  const result = normalizeDeadlineForOpen(future, now);
  assert.equal(result.deadline, future);
  assert.equal(result.clearedPastDeadline, false);
});

test("normalizeDeadlineForOpen: null stays null", () => {
  const result = normalizeDeadlineForOpen(null);
  assert.equal(result.deadline, null);
  assert.equal(result.clearedPastDeadline, false);
});

test("reopen with cleared deadline uses 30 days from opened_at", () => {
  const openedAt = "2026-10-26T15:00:00.000Z";
  const closes = campaignClosesAt({
    deadline: null,
    opened_at: openedAt,
    created_at: "2026-01-01T00:00:00.000Z",
  });
  const expected = new Date(
    new Date(openedAt).getTime() + CAMPAIGN_DEFAULT_DAYS * 24 * 60 * 60 * 1000
  );
  assert.equal(closes.toISOString(), expected.toISOString());
  const days = daysUntilCampaignCloses({
    deadline: null,
    opened_at: openedAt,
    created_at: openedAt,
  });
  assert.ok(days !== null && days >= CAMPAIGN_DEFAULT_DAYS - 1 && days <= CAMPAIGN_DEFAULT_DAYS);
});
