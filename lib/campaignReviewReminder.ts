import { campaignClosesAt } from "@/lib/campaignLifecycle";
import { isCampaignReminderBacklog } from "@/lib/campaignReminderBacklog";
import {
  REVIEW_REMINDER_FALLBACK_DAYS,
  REVIEW_REMINDER_SECOND_DAYS,
  isReviewFromRealCompletionEnabled,
  publishDeadlineDueMs,
  reviewReminderDueMs,
} from "@/lib/reviewReminder";
import {
  effectiveFirstReminderSentAt,
  effectiveSecondReminderSentAt,
  type ReminderStampRow,
  type ReviewPartySide,
} from "@/lib/reviewReminderStamps";

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

  const now = opts.nowMs ?? Date.now();
  const completionMs = new Date(opts.realCompletedAt).getTime();
  if (Number.isFinite(completionMs) && isCampaignReminderBacklog(completionMs, { nowMs: now })) {
    return false;
  }

  const fromReal = opts.fromRealCompletion ?? isReviewFromRealCompletionEnabled();
  const due = reviewReminderDueMs({
    publishDeadline: opts.publishDeadline,
    realCompletedAt: opts.realCompletedAt,
    fallbackDays: REVIEW_REMINDER_FALLBACK_DAYS,
    fromRealCompletion: fromReal || true,
  });
  if (due == null) return false;
  return now >= due;
}

/** First-wave due for one party on a campaign application. */
export function shouldSendSideCampaignReviewReminder(
  party: ReviewPartySide,
  opts: {
    status?: string | null;
    row: ReminderStampRow;
    publishDeadline?: string | null;
    realCompletedAt?: string | null;
    nowMs?: number;
    fromRealCompletion?: boolean;
  }
): boolean {
  const status = (opts.status || "").toLowerCase();
  if (status === "cancelled" || status === "canceled" || status === "rejected" || status === "withdrawn") {
    return false;
  }
  if (effectiveFirstReminderSentAt(party, opts.row)) return false;
  if (!opts.realCompletedAt) return false;

  const now = opts.nowMs ?? Date.now();
  const completionMs = new Date(opts.realCompletedAt).getTime();
  if (Number.isFinite(completionMs) && isCampaignReminderBacklog(completionMs, { nowMs: now })) {
    return false;
  }

  const fromReal = opts.fromRealCompletion ?? isReviewFromRealCompletionEnabled();
  const due = reviewReminderDueMs({
    publishDeadline: opts.publishDeadline,
    realCompletedAt: opts.realCompletedAt,
    fallbackDays: REVIEW_REMINDER_FALLBACK_DAYS,
    fromRealCompletion: fromReal || true,
  });
  if (due == null) return false;
  return now >= due;
}

export function shouldSendSideCampaignSecondReviewReminder(
  party: ReviewPartySide,
  opts: {
    status?: string | null;
    row: ReminderStampRow;
    nowMs?: number;
    secondDays?: number;
  }
): boolean {
  const status = (opts.status || "").toLowerCase();
  if (status === "cancelled" || status === "canceled" || status === "rejected" || status === "withdrawn") {
    return false;
  }
  const first = effectiveFirstReminderSentAt(party, opts.row);
  if (!first) return false;
  if (effectiveSecondReminderSentAt(party, opts.row)) return false;
  const firstMs = new Date(first).getTime();
  if (!Number.isFinite(firstMs)) return false;
  const days = opts.secondDays ?? REVIEW_REMINDER_SECOND_DAYS;
  const now = opts.nowMs ?? Date.now();
  return now >= firstMs + days * 24 * 60 * 60 * 1000;
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

export type CampaignDeliverableDeadlineInput = {
  deadline?: string | null;
  opened_at?: string | null;
  created_at?: string | null;
};

/**
 * Due instant for creator deliverable waves on campaign applications:
 * explicit deadline (date-only → end of UTC day) or lifecycle close via campaignClosesAt.
 */
export function campaignEffectiveDeliverableDueMs(
  input: CampaignDeliverableDeadlineInput
): number | null {
  const merged = (input.deadline || "").trim();
  if (merged) {
    const eod = publishDeadlineDueMs(merged);
    if (eod != null) return eod;
    const instant = new Date(merged).getTime();
    return Number.isFinite(instant) ? instant : null;
  }
  const created = input.created_at || input.opened_at;
  if (!created) return null;
  return campaignClosesAt({
    deadline: null,
    opened_at: input.opened_at ?? null,
    created_at: created,
  }).getTime();
}

export function publishDeadlineDueMsForCampaign(
  appDeadline: string | null | undefined,
  campaignDeadline: string | null | undefined,
  lifecycle?: CampaignDeliverableDeadlineInput
): number | null {
  const merged = campaignPublishDeadline(appDeadline, campaignDeadline);
  if (merged) {
    const eod = publishDeadlineDueMs(merged);
    if (eod != null) return eod;
    const instant = new Date(merged).getTime();
    return Number.isFinite(instant) ? instant : null;
  }
  if (!lifecycle) return null;
  return campaignEffectiveDeliverableDueMs({
    deadline: lifecycle.deadline ?? null,
    opened_at: lifecycle.opened_at,
    created_at: lifecycle.created_at,
  });
}

export { isCampaignReminderBacklog } from "@/lib/campaignReminderBacklog";