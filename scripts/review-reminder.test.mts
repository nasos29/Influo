import assert from "node:assert/strict";
import test from "node:test";
import { AGREEMENT_TERMS } from "../lib/agreementTermsCopy.ts";
import { EMAIL_NEXT_STEPS } from "../lib/emailNextSteps.ts";
import {
  REVIEW_REMINDER_FALLBACK_DAYS,
  publishDeadlineDueMs,
  reviewReminderDueMs,
  shouldSendReviewReminder,
} from "../lib/reviewReminder.ts";

test("publish_deadline due is end of that UTC day", () => {
  const due = publishDeadlineDueMs("2026-11-20");
  assert.equal(due, Date.UTC(2026, 10, 20, 23, 59, 59, 999));
  assert.equal(publishDeadlineDueMs("not-a-date"), null);
  assert.equal(publishDeadlineDueMs(null), null);
});

test("fallback uses agreement_accepted_at + default days when no deadline", () => {
  const accepted = "2026-11-01T10:00:00.000Z";
  const due = reviewReminderDueMs({ agreementAcceptedAt: accepted, publishDeadline: null });
  assert.equal(due, Date.parse(accepted) + REVIEW_REMINDER_FALLBACK_DAYS * 24 * 60 * 60 * 1000);
});

test("publish_deadline wins over fallback days", () => {
  const accepted = "2026-11-01T10:00:00.000Z";
  const due = reviewReminderDueMs({
    agreementAcceptedAt: accepted,
    publishDeadline: "2026-11-05",
  });
  assert.equal(due, publishDeadlineDueMs("2026-11-05"));
});

test("shouldSendReviewReminder gates on completed + due + not yet sent", () => {
  const accepted = "2026-10-01T10:00:00.000Z";
  const nowMs = Date.parse("2026-11-12T12:00:00.000Z");
  assert.equal(
    shouldSendReviewReminder({
      status: "completed",
      agreementAcceptedAt: accepted,
      publishDeadline: null,
      nowMs,
    }),
    true
  );
  assert.equal(
    shouldSendReviewReminder({
      status: "accepted",
      agreementAcceptedAt: accepted,
      nowMs,
    }),
    false
  );
  assert.equal(
    shouldSendReviewReminder({
      status: "completed",
      agreementAcceptedAt: accepted,
      reviewReminderSentAt: "2026-11-10T08:00:00.000Z",
      nowMs,
    }),
    false
  );
  assert.equal(
    shouldSendReviewReminder({
      status: "completed",
      agreementAcceptedAt: "2026-11-10T10:00:00.000Z",
      publishDeadline: null,
      nowMs,
      fallbackDays: 14,
    }),
    false
  );
  assert.equal(
    shouldSendReviewReminder({
      status: "completed",
      agreementAcceptedAt: accepted,
      publishDeadline: "2026-11-20",
      nowMs,
    }),
    false
  );
  assert.equal(
    shouldSendReviewReminder({
      status: "completed",
      agreementAcceptedAt: accepted,
      publishDeadline: "2026-11-12",
      nowMs: Date.parse("2026-11-12T23:59:59.999Z"),
    }),
    true
  );
});

test("deal-complete next steps are work steps, review reminder is separate", () => {
  assert.equal(AGREEMENT_TERMS.el.length, 8);
  assert.match(AGREEMENT_TERMS.el[0]!, /Αντικείμενο/);
  for (const step of EMAIL_NEXT_STEPS.deal_complete_creator) {
    assert.doesNotMatch(step.el, /αξιολόγ/i);
  }
  for (const step of EMAIL_NEXT_STEPS.deal_complete_brand) {
    assert.doesNotMatch(step.el, /αξιολόγ/i);
  }
  assert.match(EMAIL_NEXT_STEPS.deal_complete_creator.map((s) => s.el).join(" "), /προκαταβολή|πληρωμή/);
  assert.match(EMAIL_NEXT_STEPS.review_reminder_brand[0]!.el, /Reviews/);
  assert.match(EMAIL_NEXT_STEPS.review_reminder_brand.map((s) => s.el).join(" "), /@influo\.gr|Influo/);
  assert.match(EMAIL_NEXT_STEPS.review_reminder_creator.map((s) => s.el).join(" "), /@influo\.gr/);
});
