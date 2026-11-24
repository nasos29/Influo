import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CAMPAIGN_INTERIM_DEFAULT_DAYS,
  CAMPAIGN_LEGACY_DEFAULT_DAYS,
  campaignClosesAt,
} from "../lib/campaignLifecycle.ts";
import { isCampaignReminderBacklog } from "../lib/campaignReminderBacklog.ts";
import {
  campaignEffectiveDeliverableDueMs,
  shouldSendCampaignReviewReminder,
} from "../lib/campaignReviewReminder.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

test("no-deadline post-cutoff campaign uses 15-day close", () => {
  const openedAt = "2026-11-09T12:00:00.000Z";
  const due = campaignEffectiveDeliverableDueMs({
    deadline: null,
    opened_at: openedAt,
    created_at: openedAt,
  });
  const expected = campaignClosesAt({
    deadline: null,
    opened_at: openedAt,
    created_at: openedAt,
  }).getTime();
  assert.equal(due, expected);
  const days = (due! - new Date(openedAt).getTime()) / DAY_MS;
  assert.equal(days, CAMPAIGN_INTERIM_DEFAULT_DAYS);
});

test("no-deadline pre-cutoff campaign uses 30-day close", () => {
  const openedAt = "2026-11-01T12:00:00.000Z";
  const due = campaignEffectiveDeliverableDueMs({
    deadline: null,
    opened_at: openedAt,
    created_at: openedAt,
  });
  const days = (due! - new Date(openedAt).getTime()) / DAY_MS;
  assert.equal(days, CAMPAIGN_LEGACY_DEFAULT_DAYS);
});

test("explicit date-only deadline uses end of UTC day", () => {
  const due = campaignEffectiveDeliverableDueMs({ deadline: "2026-12-01" });
  assert.equal(due, Date.UTC(2026, 11, 1, 23, 59, 59, 999));
});

test("isCampaignReminderBacklog: effective deadline older than 30 days", () => {
  const now = Date.UTC(2026, 5, 1, 12, 0, 0);
  const deadlineEnd = Date.UTC(2026, 3, 1, 23, 59, 59, 999);
  assert.equal(isCampaignReminderBacklog(deadlineEnd, { nowMs: now }), true);
  assert.equal(isCampaignReminderBacklog(deadlineEnd, { nowMs: deadlineEnd + 30 * DAY_MS }), false);
});

test("brand-approve path: delivery_submitted_at older than 30 days is backlog", () => {
  const now = Date.UTC(2026, 6, 1, 0, 0, 0);
  const submitted = Date.UTC(2026, 4, 1, 0, 0, 0);
  assert.equal(isCampaignReminderBacklog(submitted, { nowMs: now }), true);
  const recent = Date.UTC(2026, 5, 25, 0, 0, 0);
  assert.equal(isCampaignReminderBacklog(recent, { nowMs: now }), false);
});

test("review reminder skips stale real completion", () => {
  const now = new Date("2026-08-01T12:00:00Z").getTime();
  assert.equal(
    shouldSendCampaignReviewReminder({
      status: "accepted",
      realCompletedAt: "2026-05-01T00:00:00Z",
      nowMs: now,
      fromRealCompletion: true,
    }),
    false
  );
});

test("review reminder still due for recent completion", () => {
  const completed = "2026-07-28T00:00:00Z";
  const now = new Date("2026-08-01T12:00:00Z").getTime();
  assert.equal(
    shouldSendCampaignReviewReminder({
      status: "accepted",
      realCompletedAt: completed,
      nowMs: now,
      fromRealCompletion: true,
    }),
    true
  );
});

test("recent effective deadline is not backlog", () => {
  const now = Date.UTC(2026, 11, 10, 12, 0, 0);
  const openedAt = "2026-11-09T12:00:00.000Z";
  const due = campaignEffectiveDeliverableDueMs({
    deadline: null,
    opened_at: openedAt,
    created_at: openedAt,
  });
  assert.equal(isCampaignReminderBacklog(due!, { nowMs: now }), false);
});