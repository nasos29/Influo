import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMPAIGN_DEFAULT_DAYS,
  CAMPAIGN_INTERIM_DEFAULT_DAYS,
  campaignClosesAt,
  deadlineFromOpenedAt,
  inferApplicationWindowDays,
  isCampaignAcceptingApplications,
  normalizeDeadlineForOpen,
  parseApplicationWindowDays,
  resolveSaveDeadlineIso,
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

test("interim window: post-30-day-cutoff and before seven-day cutoff uses 15 days", () => {
  const openedAt = "2026-11-09T12:00:00.000Z";
  const closes = campaignClosesAt({
    deadline: null,
    opened_at: openedAt,
    created_at: "2026-01-01T00:00:00.000Z",
  });
  const expected = new Date(
    new Date(openedAt).getTime() + CAMPAIGN_INTERIM_DEFAULT_DAYS * 24 * 60 * 60 * 1000
  );
  assert.equal(closes.toISOString(), expected.toISOString());
});

test("post-seven-day-cutoff open without deadline uses CAMPAIGN_DEFAULT_DAYS", () => {
  const openedAt = "2026-11-25T12:00:00.000Z";
  const closes = campaignClosesAt({
    deadline: null,
    opened_at: openedAt,
    created_at: openedAt,
  });
  const expected = new Date(
    new Date(openedAt).getTime() + CAMPAIGN_DEFAULT_DAYS * 24 * 60 * 60 * 1000
  );
  assert.equal(closes.toISOString(), expected.toISOString());
});

test("campaignClosesAt respects defaultDays override after interim cutoff", () => {
  const openedAt = "2026-11-25T12:00:00.000Z";
  const closes = campaignClosesAt(
    {
      deadline: null,
      opened_at: openedAt,
      created_at: openedAt,
    },
    { defaultDays: 20 }
  );
  const expected = new Date(new Date(openedAt).getTime() + 20 * 24 * 60 * 60 * 1000);
  assert.equal(closes.toISOString(), expected.toISOString());
});

test("resolveSaveDeadlineIso: stay-open edit keeps null legacy deadline", () => {
  const openedAt = "2026-11-09T12:00:00.000Z";
  assert.equal(
    resolveSaveDeadlineIso({
      status: "open",
      openingNow: false,
      wasOpen: true,
      existingDeadline: null,
      openAnchorIso: openedAt,
      windowDays: 7,
      draftAnchor: openedAt,
    }),
    null
  );
});

test("resolveSaveDeadlineIso: reopen sets deadline from window", () => {
  const openedAt = "2026-11-25T12:00:00.000Z";
  assert.equal(
    resolveSaveDeadlineIso({
      status: "open",
      openingNow: true,
      wasOpen: false,
      existingDeadline: null,
      openAnchorIso: openedAt,
      windowDays: 7,
      draftAnchor: null,
    }),
    deadlineFromOpenedAt(openedAt, 7)
  );
});

test("deadlineFromOpenedAt adds exact N×24h", () => {
  const openedAt = "2026-11-24T18:30:00.000Z";
  assert.equal(
    deadlineFromOpenedAt(openedAt, 7),
    new Date(Date.parse(openedAt) + 7 * 24 * 60 * 60 * 1000).toISOString()
  );
});

test("parseApplicationWindowDays and inferApplicationWindowDays", () => {
  assert.equal(parseApplicationWindowDays(14), 14);
  assert.equal(parseApplicationWindowDays("nope"), 7);
  const opened = "2026-11-01T10:00:00.000Z";
  const dl = deadlineFromOpenedAt(opened, 3);
  assert.equal(inferApplicationWindowDays(dl, opened, opened), 3);
  assert.equal(inferApplicationWindowDays("2026-12-31T10:00:00.000Z", opened, opened), 7);
});

test("isCampaignAcceptingApplications: open but past effective close", () => {
  const openedAt = "2026-10-01T10:00:00.000Z";
  const now = new Date("2026-11-15T10:00:00.000Z");
  assert.equal(
    isCampaignAcceptingApplications(
      {
        status: "open",
        deadline: null,
        opened_at: openedAt,
        created_at: openedAt,
      },
      now
    ),
    false
  );
  const futureDl = deadlineFromOpenedAt("2026-11-10T10:00:00.000Z", 7);
  assert.equal(
    isCampaignAcceptingApplications(
      {
        status: "open",
        deadline: futureDl,
        opened_at: "2026-11-10T10:00:00.000Z",
        created_at: "2026-11-10T10:00:00.000Z",
      },
      new Date("2026-11-12T10:00:00.000Z")
    ),
    true
  );
});