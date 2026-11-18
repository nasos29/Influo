/** Campaign reminder cron must not email stale accepted deals (default 30 days). */
export const CAMPAIGN_REMINDER_BACKLOG_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * True when `referenceMs` is more than `windowDays` before `nowMs` (stale backlog).
 */
export function isCampaignReminderBacklog(
  referenceMs: number,
  opts?: { nowMs?: number; windowDays?: number }
): boolean {
  if (!Number.isFinite(referenceMs)) return true;
  const now = opts?.nowMs ?? Date.now();
  const window = (opts?.windowDays ?? CAMPAIGN_REMINDER_BACKLOG_DAYS) * DAY_MS;
  return now - referenceMs > window;
}