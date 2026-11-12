/**
 * One-shot reminder when exactly one side accepted the agreement summary and the
 * other has not, 48–96h after the first acceptance. The daily cron claims the
 * row via proposals.agreement_reminder_sent_at, so each deal is reminded at most once.
 */

export const AGREEMENT_REMINDER_MIN_HOURS = 48;
export const AGREEMENT_REMINDER_MAX_HOURS = 96;

const HOUR_MS = 60 * 60 * 1000;

export type AgreementReminderRow = {
  status?: string | null;
  influencer_agreement_accepted?: boolean | null;
  brand_agreement_accepted?: boolean | null;
  influencer_agreement_accepted_at?: string | null;
  brand_agreement_accepted_at?: string | null;
  agreement_reminder_sent_at?: string | null;
};

/** Who should get the reminder ("brand" when the creator accepted, and vice versa), or null. */
export function agreementReminderTarget(row: AgreementReminderRow, nowMs = Date.now()): "brand" | "creator" | null {
  const status = String(row.status || "").toLowerCase();
  if (status !== "accepted" && status !== "completed") return null;
  if (row.agreement_reminder_sent_at) return null;
  const creatorOk = row.influencer_agreement_accepted === true;
  const brandOk = row.brand_agreement_accepted === true;
  if (creatorOk === brandOk) return null;

  const firstAt = creatorOk ? row.influencer_agreement_accepted_at : row.brand_agreement_accepted_at;
  const firstMs = firstAt ? Date.parse(firstAt) : NaN;
  if (!Number.isFinite(firstMs)) return null;
  const age = nowMs - firstMs;
  if (age < AGREEMENT_REMINDER_MIN_HOURS * HOUR_MS || age > AGREEMENT_REMINDER_MAX_HOURS * HOUR_MS) return null;
  return creatorOk ? "brand" : "creator";
}
