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

/**
 * 7-day safety net cron. Default OFF.
 * Auto-complete fires only for link-mode (published link) submissions.
 * Event mode past 7 days notifies admin instead (no auto-complete).
 */
export function isDeliveryAutoCompleteEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return envOn(env.DELIVERY_AUTO_COMPLETE_ENABLED);
}

/** Email both parties when link-mode auto-complete fires. Default OFF. */
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

/** Email both parties when a started deal is cancelled. Default OFF. */
export function isDealCancelEmailsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return envOn(env.DEAL_CANCEL_EMAILS_ENABLED);
}

/**
 * Email when a started campaign deal is cancelled.
 * CAMPAIGN_DEAL_CANCEL_EMAILS_ENABLED overrides; otherwise falls back to DEAL_CANCEL_EMAILS_ENABLED. Default OFF.
 */
export function isCampaignDealCancelEmailsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const explicit = (env.CAMPAIGN_DEAL_CANCEL_EMAILS_ENABLED || "").trim();
  if (explicit) return envOn(explicit);
  return isDealCancelEmailsEnabled(env);
}

/** Cron: auto-cancel stale pending proposals. Default OFF. */
export function isPendingProposalExpireEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return envOn(env.PENDING_PROPOSAL_EXPIRE_ENABLED);
}

/** Stable cancel_reason token when cron expires a pending proposal. */
export const PENDING_EXPIRED_CANCEL_REASON = "pending_expired";

/** Days after created_at before a pending proposal expires. Default 14. */
export function pendingProposalExpireDays(env: NodeJS.ProcessEnv = process.env): number {
  const raw = String(env.PENDING_PROPOSAL_EXPIRE_DAYS ?? "").trim();
  if (!raw) return 14;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 14;
}

/** Days before publish_deadline for the creator submit reminder. */
export const DELIVERABLE_REMINDER_BEFORE_DAYS = 2;
/** Days after publish_deadline for first overdue reminder. */
export const DELIVERABLE_REMINDER_AFTER_1_DAYS = 1;
/** Days after publish_deadline for second overdue reminder. */
export const DELIVERABLE_REMINDER_AFTER_5_DAYS = 5;
/** Days after acceptance / agreement for a single gentle deliverable nudge (no publish deadline). */
export const DELIVERABLE_REMINDER_GENTLE_DAYS = 7;
/** Days after submission before brand approve reminder. */
export const BRAND_APPROVE_REMINDER_DAYS = 2;
/** Days after submission before link auto-complete / event admin notify. */
export const DELIVERY_AUTO_COMPLETE_DAYS = 7;

/** Cron: deliverable warning (day 10) + auto-cancel 3 Athens days after warning. Default OFF. */
export function isDeliverableAutocancelEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return envOn(env.DELIVERABLE_AUTOCANCEL_ENABLED);
}

/**
 * Email on deliverable warning + system auto-cancel (creator/brand).
 * When autocancel is ON: sends unless DELIVERABLE_AUTOCANCEL_EMAILS_ENABLED is explicitly off.
 * When autocancel is OFF: follows explicit env only (default off).
 */
export function isDeliverableAutocancelEmailsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = String(env.DELIVERABLE_AUTOCANCEL_EMAILS_ENABLED ?? "").trim();
  if (/^(0|false|no|off)$/i.test(raw)) return false;
  if (isDeliverableAutocancelEnabled(env)) return true;
  return envOn(raw);
}

/** ISO instant — only acceptances on/after this are eligible for automatic warning (cron). */
export function deliverableAutocancelSinceMs(env: NodeJS.ProcessEnv = process.env): number | null {
  const raw = String(env.DELIVERABLE_AUTOCANCEL_SINCE ?? "").trim();
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export const DELIVERABLE_AUTOCANCEL_WARNING_DAYS = 10;
export const DELIVERABLE_AUTOCANCEL_DAYS_AFTER_WARNING = 3;
export const DELIVERABLE_AUTOCANCEL_REASON = "Δεν υποβλήθηκε παραδοτέο";
