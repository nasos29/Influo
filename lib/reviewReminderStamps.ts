/** Per-party review reminder stamps + legacy combined column handling. */

export type ReviewPartySide = "brand" | "influencer";

export type ReminderStampRow = {
  agreement_accepted_at?: string | null;
  delivery_confirmed_at?: string | null;
  auto_completed_at?: string | null;
  review_reminder_sent_at?: string | null;
  review_reminder_second_sent_at?: string | null;
  brand_review_reminder_sent_at?: string | null;
  influencer_review_reminder_sent_at?: string | null;
  brand_review_reminder_second_sent_at?: string | null;
  influencer_review_reminder_second_sent_at?: string | null;
};

const BACKFILL_WINDOW_MS = 2000;

function confirmInstantMs(row: ReminderStampRow): number | null {
  const at = row.delivery_confirmed_at || row.auto_completed_at;
  if (!at) return null;
  const ms = new Date(at).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function stampNearInstant(stamp: string | null | undefined, instantMs: number): boolean {
  if (!stamp) return false;
  const ms = new Date(stamp).getTime();
  if (!Number.isFinite(ms)) return false;
  return Math.abs(ms - instantMs) < BACKFILL_WINDOW_MS;
}

/** Bulk/off-path confirm stamps both reminder waves at once — not real sends. */
export function isConfirmTimeDualReminderBackfill(
  row: ReminderStampRow,
  firstStamp: string | null | undefined,
  secondStamp: string | null | undefined
): boolean {
  const confirmMs = confirmInstantMs(row);
  if (!confirmMs || !firstStamp || !secondStamp) return false;
  return stampNearInstant(firstStamp, confirmMs) && stampNearInstant(secondStamp, confirmMs);
}

function rawFirstStamp(party: ReviewPartySide, row: ReminderStampRow): string | null {
  const side =
    party === "brand" ? row.brand_review_reminder_sent_at : row.influencer_review_reminder_sent_at;
  return side || row.review_reminder_sent_at || null;
}

function rawSecondStamp(party: ReviewPartySide, row: ReminderStampRow): string | null {
  const side =
    party === "brand"
      ? row.brand_review_reminder_second_sent_at
      : row.influencer_review_reminder_second_sent_at;
  return side || row.review_reminder_second_sent_at || null;
}

/** True when review_reminder_sent_at was the migration backfill (agreement lock), not a real email. */
export function isLegacyReviewReminderBackfill(
  reviewReminderSentAt?: string | null,
  agreementAcceptedAt?: string | null
): boolean {
  if (!reviewReminderSentAt || !agreementAcceptedAt) return false;
  const a = new Date(reviewReminderSentAt).getTime();
  const b = new Date(agreementAcceptedAt).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) < 2000;
}

export function effectiveFirstReminderSentAt(
  party: ReviewPartySide,
  row: ReminderStampRow
): string | null {
  const firstRaw = rawFirstStamp(party, row);
  const secondRaw = rawSecondStamp(party, row);
  if (isConfirmTimeDualReminderBackfill(row, firstRaw, secondRaw)) return null;

  const sideAt =
    party === "brand" ? row.brand_review_reminder_sent_at : row.influencer_review_reminder_sent_at;
  if (sideAt) return sideAt;
  const legacy = row.review_reminder_sent_at;
  if (!legacy) return null;
  if (isLegacyReviewReminderBackfill(legacy, row.agreement_accepted_at)) return null;
  return legacy;
}

export function effectiveSecondReminderSentAt(
  party: ReviewPartySide,
  row: ReminderStampRow
): string | null {
  const firstRaw = rawFirstStamp(party, row);
  const secondRaw = rawSecondStamp(party, row);
  if (isConfirmTimeDualReminderBackfill(row, firstRaw, secondRaw)) return null;

  const sideAt =
    party === "brand"
      ? row.brand_review_reminder_second_sent_at
      : row.influencer_review_reminder_second_sent_at;
  if (sideAt) return sideAt;
  const legacyFirst = effectiveFirstReminderSentAt(party, row);
  if (!legacyFirst) return null;
  const legacySecond = row.review_reminder_second_sent_at;
  return legacySecond || null;
}

export const PROPOSAL_REMINDER_STAMP_COLS =
  "brand_review_reminder_sent_at, influencer_review_reminder_sent_at, brand_review_reminder_second_sent_at, influencer_review_reminder_second_sent_at";