/**
 * Feature flags for delivery completion reminders / auto-complete / review pivot.
 * All default OFF so deploys are silent until ops enables them.
 */

function envOn(raw: string | undefined | null): boolean {
  return /^(1|true|yes|on)$/i.test(String(raw || "").trim());
}

/** Creator deliverable reminders (before/after publish_deadline). Default OFF. */
export function isDeliverableRemindersEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return envOn(env.DELIVERABLE_REMINDERS_ENABLED);
}

/** Brand reminder to approve a pending deliverable after 2 days. Default OFF. */
export function isBrandApproveRemindersEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return envOn(env.BRAND_APPROVE_REMINDERS_ENABLED);
}

/** 7-day auto-complete when brand ignores a submitted deliverable. Default OFF. */
export function isDeliveryAutoCompleteEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return envOn(env.DELIVERY_AUTO_COMPLETE_ENABLED);
}

/** Email both parties when auto-complete fires. Default OFF. */
export function isDeliveryAutoCompleteEmailEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return envOn(env.DELIVERY_AUTO_COMPLETE_EMAIL_ENABLED);
}

/**
 * When ON, review reminders require delivery_confirmed_at or auto_completed_at
 * (real completion). Legacy completed-without-confirmation deals are skipped for review.
 * Default OFF until migration is applied and ops is ready (avoids breaking current cron).
 */
export function isReviewFromRealCompletionEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return envOn(env.REVIEW_FROM_REAL_COMPLETION_ENABLED);
}

/** Days before publish_deadline for the creator submit reminder. */
export const DELIVERABLE_REMINDER_BEFORE_DAYS = 2;
/** Days after publish_deadline for first overdue reminder. */
export const DELIVERABLE_REMINDER_AFTER_1_DAYS = 1;
/** Days after publish_deadline for second overdue reminder. */
export const DELIVERABLE_REMINDER_AFTER_5_DAYS = 5;
/** Days after submission before brand approve reminder. */
export const BRAND_APPROVE_REMINDER_DAYS = 2;
/** Days after submission before auto-complete. */
export const DELIVERY_AUTO_COMPLETE_DAYS = 7;
