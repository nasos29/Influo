/**
 * When to email a post-deal review reminder for completed proposals.
 * Prefer publish_deadline (end of that calendar day UTC); otherwise
 * agreement_accepted_at + REVIEW_REMINDER_FALLBACK_DAYS.
 */

export const REVIEW_REMINDER_FALLBACK_DAYS = 14;

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
  fallbackDays?: number;
}): number | null {
  const fromDeadline = publishDeadlineDueMs(opts.publishDeadline);
  if (fromDeadline != null) return fromDeadline;

  const accepted = opts.agreementAcceptedAt ? new Date(opts.agreementAcceptedAt).getTime() : NaN;
  if (!Number.isFinite(accepted)) return null;
  const days = opts.fallbackDays ?? REVIEW_REMINDER_FALLBACK_DAYS;
  return accepted + days * 24 * 60 * 60 * 1000;
}

/** True when a completed deal is due for a one-shot review reminder. */
export function shouldSendReviewReminder(opts: {
  status?: string | null;
  reviewReminderSentAt?: string | null;
  publishDeadline?: string | null;
  agreementAcceptedAt?: string | null;
  nowMs?: number;
  fallbackDays?: number;
}): boolean {
  if ((opts.status || "").toLowerCase() !== "completed") return false;
  if (opts.reviewReminderSentAt) return false;
  const due = reviewReminderDueMs({
    publishDeadline: opts.publishDeadline,
    agreementAcceptedAt: opts.agreementAcceptedAt,
    fallbackDays: opts.fallbackDays,
  });
  if (due == null) return false;
  const now = opts.nowMs ?? Date.now();
  return now >= due;
}
