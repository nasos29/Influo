import assert from "node:assert/strict";
import { test } from "node:test";
import { isCollabEmailExcludedInfluencer, PALLI_INFLUENCER_ID } from "../lib/collabEmailExclusion.ts";
import {
  collaborationProgressLabel,
  deliveryStateLabel,
  isDeliveryPendingBrand,
  isEventConfirmPending,
  isRealDeliveryComplete,
  mayShowEventCollabPublicly,
  realCompletionAt,
  shouldAutoCompleteDelivery,
} from "../lib/deliveryCompletion.ts";
import {
  isBrandApproveRemindersEnabled,
  isDeliverableRemindersEnabled,
  isDeliveryAutoCompleteEnabled,
  isReviewFromRealCompletionEnabled,
} from "../lib/deliveryFlags.ts";
import {
  isAdminDailyDigestEnabled,
  isBrandApplicationDigestEnabled,
} from "../lib/emailDigestFlags.ts";
import {
  isReviewFromRealCompletionEnabled as reviewFlag,
  reviewReminderDueMs,
  shouldSendReviewReminder,
} from "../lib/reviewReminder.ts";
import { isAthensAdminDigestWindow, shouldQueueAdminDigest } from "../lib/adminDailyDigest.ts";

test("Maria Palli influencer id is excluded from collab emails", () => {
  assert.equal(isCollabEmailExcludedInfluencer(PALLI_INFLUENCER_ID), true);
  assert.equal(isCollabEmailExcludedInfluencer("00000000-0000-0000-0000-000000000000"), false);
});

test("delivery flags default OFF", () => {
  const prev = { ...process.env };
  for (const k of [
    "DELIVERABLE_REMINDERS_ENABLED",
    "BRAND_APPROVE_REMINDERS_ENABLED",
    "DELIVERY_AUTO_COMPLETE_ENABLED",
    "REVIEW_FROM_REAL_COMPLETION_ENABLED",
    "BRAND_APPLICATION_DIGEST_ENABLED",
    "ADMIN_DAILY_DIGEST_ENABLED",
  ]) {
    delete process.env[k];
  }
  assert.equal(isDeliverableRemindersEnabled(), false);
  assert.equal(isBrandApproveRemindersEnabled(), false);
  assert.equal(isDeliveryAutoCompleteEnabled(), false);
  assert.equal(isReviewFromRealCompletionEnabled(), false);
  assert.equal(isBrandApplicationDigestEnabled(), false);
  assert.equal(isAdminDailyDigestEnabled(), false);
  Object.assign(process.env, prev);
});

test("real completion helpers", () => {
  assert.equal(isRealDeliveryComplete({}), false);
  assert.equal(
    isRealDeliveryComplete({ delivery_confirmed_at: "2026-11-01T00:00:00.000Z" }),
    true
  );
  assert.equal(isRealDeliveryComplete({ auto_completed_at: "2026-11-01T00:00:00.000Z" }), true);
  assert.equal(
    realCompletionAt({
      delivery_confirmed_at: "2026-11-02T00:00:00.000Z",
      auto_completed_at: "2026-11-01T00:00:00.000Z",
    }),
    "2026-11-02T00:00:00.000Z"
  );
  assert.equal(
    isDeliveryPendingBrand({
      delivery_submitted_at: "2026-11-01T00:00:00.000Z",
      delivery_confirmed_at: null,
    }),
    true
  );
  assert.match(deliveryStateLabel({ status: "completed" }, "el"), /εξέλιξη/i);
  assert.match(deliveryStateLabel({ delivery_confirmed_at: "2026-11-01T00:00:00.000Z" }, "el"), /Ολοκληρώθηκε/);
});

test("collaboration progress labels", () => {
  assert.equal(collaborationProgressLabel({ status: "completed" }, "el"), "Σε εξέλιξη");
  assert.equal(
    collaborationProgressLabel({ status: "completed", delivery_confirmed_at: "2026-11-01T00:00:00.000Z" }, "el"),
    "Ολοκληρώθηκε"
  );
  assert.equal(collaborationProgressLabel({ status: "completed" }, "en"), "In progress");
});

test("event collabs stay private unless admin allows", () => {
  assert.equal(
    mayShowEventCollabPublicly({
      delivery_mode: "event",
      showcase_event_admin_allowed: false,
      delivery_proof_url: "https://example.com/p.jpg",
    }),
    false
  );
  assert.equal(
    mayShowEventCollabPublicly({
      delivery_mode: "event",
      showcase_event_admin_allowed: true,
      delivery_proof_url: "https://example.com/p.jpg",
    }),
    true
  );
  assert.equal(mayShowEventCollabPublicly({ delivery_mode: "link" }), true);
});

test("auto-complete is link-mode only; abandoned deals never auto-complete", () => {
  assert.equal(
    shouldAutoCompleteDelivery({
      delivery_mode: "link",
      delivery_submitted_at: "2026-11-01T00:00:00.000Z",
    }),
    true
  );
  assert.equal(
    shouldAutoCompleteDelivery({
      delivery_mode: "event",
      delivery_submitted_at: "2026-11-01T00:00:00.000Z",
    }),
    false
  );
  assert.equal(shouldAutoCompleteDelivery({ delivery_mode: "link" }), false);
  assert.equal(shouldAutoCompleteDelivery({ delivery_mode: null }), false);
  assert.equal(shouldAutoCompleteDelivery({}), false);
});

test("event confirm pending badge helper", () => {
  assert.equal(
    isEventConfirmPending({
      delivery_mode: "event",
      delivery_submitted_at: "2026-11-01T00:00:00.000Z",
    }),
    true
  );
  assert.equal(
    isEventConfirmPending({
      delivery_mode: "event",
      delivery_submitted_at: "2026-11-01T00:00:00.000Z",
      delivery_confirmed_at: "2026-11-02T00:00:00.000Z",
    }),
    false
  );
  assert.equal(
    isEventConfirmPending({
      delivery_mode: "link",
      delivery_submitted_at: "2026-11-01T00:00:00.000Z",
    }),
    false
  );
  assert.match(
    deliveryStateLabel(
      {
        delivery_mode: "event",
        delivery_submitted_at: "2026-11-01T00:00:00.000Z",
      },
      "el"
    ),
    /Εκκρεμεί επιβεβαίωση/
  );
});

test("review reminders use real completion when flag on", () => {
  const confirmed = "2026-11-10T12:00:00.000Z";
  const due = reviewReminderDueMs({
    realCompletedAt: confirmed,
    fromRealCompletion: true,
    fallbackDays: 3,
  });
  assert.equal(due, Date.parse(confirmed) + 3 * 24 * 60 * 60 * 1000);

  assert.equal(
    shouldSendReviewReminder({
      status: "completed",
      agreementAcceptedAt: "2026-01-01T00:00:00.000Z",
      fromRealCompletion: true,
      nowMs: Date.now(),
    }),
    false
  );
  assert.equal(
    shouldSendReviewReminder({
      status: "completed",
      realCompletedAt: "2026-01-01T00:00:00.000Z",
      fromRealCompletion: true,
      nowMs: Date.parse("2026-01-10T00:00:00.000Z"),
    }),
    true
  );
  assert.equal(reviewFlag, isReviewFromRealCompletionEnabled);
});

test("admin digest queue gate", () => {
  const env = {} as NodeJS.ProcessEnv;
  assert.equal(shouldQueueAdminDigest("proposal", env), false);
  env.ADMIN_DAILY_DIGEST_ENABLED = "1";
  assert.equal(shouldQueueAdminDigest("proposal", env), true);
  assert.equal(shouldQueueAdminDigest("campaign_application", env), true);
  assert.equal(shouldQueueAdminDigest("event_confirm_pending", env), true);
});

test("athens admin digest window helper is boolean", () => {
  assert.equal(typeof isAthensAdminDigestWindow(Date.now()), "boolean");
});
