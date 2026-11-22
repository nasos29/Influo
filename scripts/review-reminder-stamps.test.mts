import assert from "node:assert/strict";
import { test } from "node:test";
import {
  effectiveFirstReminderSentAt,
  effectiveSecondReminderSentAt,
  isConfirmTimeDualReminderBackfill,
  isLegacyReviewReminderBackfill,
} from "../lib/reviewReminderStamps.ts";

const confirm = "2026-11-21T08:52:09.733Z";

test("first-wave only within 2s of confirm is NOT confirm backfill (claimReviewReminder)", () => {
  const row = {
    delivery_confirmed_at: confirm,
    brand_review_reminder_sent_at: confirm,
    influencer_review_reminder_sent_at: confirm,
  };
  assert.equal(isConfirmTimeDualReminderBackfill(row, confirm, null), false);
  assert.equal(effectiveFirstReminderSentAt("brand", row), confirm);
  assert.equal(effectiveFirstReminderSentAt("influencer", row), confirm);
});

test("first and second both within 2s of confirm → backfill (ignore both)", () => {
  const row = {
    delivery_confirmed_at: confirm,
    brand_review_reminder_sent_at: confirm,
    brand_review_reminder_second_sent_at: confirm,
    review_reminder_sent_at: confirm,
    review_reminder_second_sent_at: confirm,
  };
  assert.equal(
    isConfirmTimeDualReminderBackfill(row, confirm, confirm),
    true
  );
  assert.equal(effectiveFirstReminderSentAt("brand", row), null);
  assert.equal(effectiveSecondReminderSentAt("brand", row), null);
});

test("real sends hours / days after confirm are not backfill", () => {
  const row = {
    delivery_confirmed_at: confirm,
    brand_review_reminder_sent_at: "2026-11-21T14:00:00.000Z",
    brand_review_reminder_second_sent_at: "2026-11-28T10:00:00.000Z",
  };
  assert.equal(effectiveFirstReminderSentAt("brand", row), "2026-11-21T14:00:00.000Z");
  assert.equal(effectiveSecondReminderSentAt("brand", row), "2026-11-28T10:00:00.000Z");
});

test("agreement_accepted_at within 2s legacy rule still works", () => {
  const agreement = "2026-10-01T10:00:00.000Z";
  const row = {
    agreement_accepted_at: agreement,
    review_reminder_sent_at: "2026-10-01T10:00:00.500Z",
  };
  assert.equal(isLegacyReviewReminderBackfill(row.review_reminder_sent_at, agreement), true);
  assert.equal(effectiveFirstReminderSentAt("brand", row), null);
});

test("missing confirm instant → no confirm-time backfill", () => {
  const row = {
    brand_review_reminder_sent_at: confirm,
    brand_review_reminder_second_sent_at: confirm,
  };
  assert.equal(isConfirmTimeDualReminderBackfill(row, confirm, confirm), false);
  assert.equal(effectiveFirstReminderSentAt("brand", row), confirm);
});