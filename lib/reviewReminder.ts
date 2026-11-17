/**
 * When to email a post-deal review reminder for completed proposals.
 *
 * Default (legacy): prefer publish_deadline + FALLBACK_DAYS, else agreement_accepted_at.
 * When REVIEW_FROM_REAL_COMPLETION_ENABLED=1: schedule from delivery_confirmed_at or
 * auto_completed_at only (agreement acceptance is not enough). Legacy completed deals
 * without those stamps are skipped for review (they may still get deliverable reminders).
 *
 * A second (final) reminder may go out REVIEW_REMINDER_SECOND_DAYS after the first.
 */

import { isReviewFromRealCompletionEnabled } from "@/lib/deliveryFlags";

export const REVIEW_REMINDER_FALLBACK_DAYS = 3;
export const REVIEW_REMINDER_SECOND_DAYS = 7;

/**
 * Second review-reminder wave is OFF by default.
 * Historical first-wave stamps would otherwise become eligible once the column lands.
 * Enable only after ops decides: REVIEW_REMINDER_SECOND_WAVE=1
 */
export function isSecondReviewReminderWaveEnabled(): boolean {
  const raw = (process.env.REVIEW_REMINDER_SECOND_WAVE || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export { isReviewFromRealCompletionEnabled };

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;

/** End of the publish_deadline calendar day (UTC), or null if unusable. */
export function publishDeadlineDueMs(publishDeadline: string | null | undefined): number | null {
  if (!publishDeadline) return null;
  const match = DATE_ONLY.exec(String(publishDeadline).trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const end = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
  if (!Number.isFinite(end)) return null;
  const check = new Date(end);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return end;
}

/** Due instant for the review reminder, or null when we cannot schedule yet. */
export function reviewReminderDueMs(opts: {
  publishDeadline?: string | null;
  agreementAcceptedAt?: string | null;
  /** Real completion stamp (delivery_confirmed_at or auto_completed_at). */
  realCompletedAt?: string | null;
  fallbackDays?: number;
  /** Override env flag for tests. */
  fromRealCompletion?: boolean;
}): number | null {
  const days = opts.fallbackDays ?? REVIEW_REMINDER_FALLBACK_DAYS;
  const dayMs = days * 24 * 60 * 60 * 1000;
  const realOnly =
    opts.fromRealCompletion ?? isReviewFromRealCompletionEnabled();

  if (realOnly) {
    const real = opts.realCompletedAt ? new Date(opts.realCompletedAt).getTime() : NaN;
    if (!Number.isFinite(real)) return null;
    return real + dayMs;
  }

  const fromDeadline = publishDeadlineDueMs(opts.publishDeadline);
  if (fromDeadline != null) return fromDeadline + dayMs;

  const accepted = opts.agreementAcceptedAt ? new Date(opts.agreementAcceptedAt).getTime() : NaN;
  if (!Number.isFinite(accepted)) return null;
  return accepted + dayMs;
}

/** True when a completed deal is due for a one-shot review reminder. */
export function shouldSendReviewReminder(opts: {
  status?: string | null;
  reviewReminderSentAt?: string | null;
  publishDeadline?: string | null;
  agreementAcceptedAt?: string | null;
  realCompletedAt?: string | null;
  nowMs?: number;
  fallbackDays?: number;
  fromRealCompletion?: boolean;
}): boolean {
  if ((opts.status || "").toLowerCase() !== "completed") return false;
  if (opts.reviewReminderSentAt) return false;
  const due = reviewReminderDueMs({
    publishDeadline: opts.publishDeadline,
    agreementAcceptedAt: opts.agreementAcceptedAt,
    realCompletedAt: opts.realCompletedAt,
    fallbackDays: opts.fallbackDays,
    fromRealCompletion: opts.fromRealCompletion,
  });
  if (due == null) return false;
  const now = opts.nowMs ?? Date.now();
  return now >= due;
}

/** True when the second (final) reminder is due — 7 days after the first stamp. */
export function shouldSendSecondReviewReminder(opts: {
  status?: string | null;
  reviewReminderSentAt?: string | null;
  reviewReminderSecondSentAt?: string | null;
  nowMs?: number;
  secondDays?: number;
}): boolean {
  if ((opts.status || "").toLowerCase() !== "completed") return false;
  if (!opts.reviewReminderSentAt) return false;
  if (opts.reviewReminderSecondSentAt) return false;
  const first = new Date(opts.reviewReminderSentAt).getTime();
  if (!Number.isFinite(first)) return false;
  const days = opts.secondDays ?? REVIEW_REMINDER_SECOND_DAYS;
  const now = opts.nowMs ?? Date.now();
  return now >= first + days * 24 * 60 * 60 * 1000;
}
