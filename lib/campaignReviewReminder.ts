import {
  REVIEW_REMINDER_FALLBACK_DAYS,
  REVIEW_REMINDER_SECOND_DAYS,
  isReviewFromRealCompletionEnabled,
  publishDeadlineDueMs,
  reviewReminderDueMs,
} from "@/lib/reviewReminder";

/** Campaign deals stay status=accepted; review is due only after real completion. */
export function shouldSendCampaignReviewReminder(opts: {
  status?: string | null;
  reviewReminderSentAt?: string | null;
  publishDeadline?: string | null;
  realCompletedAt?: string | null;
  nowMs?: number;
  fromRealCompletion?: boolean;
}): boolean {
  const status = (opts.status || "").toLowerCase();
  if (status === "cancelled" || status === "canceled" || status === "rejected" || status === "withdrawn") {
    return false;
  }
  if (opts.reviewReminderSentAt) return false;
  if (!opts.realCompletedAt) return false;

  const fromReal = opts.fromRealCompletion ?? isReviewFromRealCompletionEnabled();
  const due = reviewReminderDueMs({
    publishDeadline: opts.publishDeadline,
    realCompletedAt: opts.realCompletedAt,
    fallbackDays: REVIEW_REMINDER_FALLBACK_DAYS,
    fromRealCompletion: fromReal || true,
  });
  if (due == null) return false;
  const now = opts.nowMs ?? Date.now();
  return now >= due;
}

export function shouldSendCampaignSecondReviewReminder(opts: {
  status?: string | null;
  reviewReminderSentAt?: string | null;
  reviewReminderSecondSentAt?: string | null;
  nowMs?: number;
}): boolean {
  const status = (opts.status || "").toLowerCase();
  if (status === "cancelled" || status === "canceled" || status === "rejected" || status === "withdrawn") {
    return false;
  }
  if (!opts.reviewReminderSentAt) return false;
  if (opts.reviewReminderSecondSentAt) return false;
  const first = new Date(opts.reviewReminderSentAt).getTime();
  if (!Number.isFinite(first)) return false;
  const now = opts.nowMs ?? Date.now();
  return now >= first + REVIEW_REMINDER_SECOND_DAYS * 24 * 60 * 60 * 1000;
}

export function campaignPublishDeadline(
  appDeadline: string | null | undefined,
  campaignDeadline: string | null | undefined
): string | null {
  const direct = (appDeadline || "").trim();
  if (direct) return direct;
  const fromCampaign = (campaignDeadline || "").trim();
  return fromCampaign || null;
}

export function publishDeadlineDueMsForCampaign(
  appDeadline: string | null | undefined,
  campaignDeadline: string | null | undefined
): number | null {
  return publishDeadlineDueMs(campaignPublishDeadline(appDeadline, campaignDeadline));
}