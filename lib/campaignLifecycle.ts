export const CAMPAIGN_DEFAULT_DAYS = 30;
export const CAMPAIGN_REMINDER_DAYS_BEFORE = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export type CampaignCloseInput = {
  deadline: string | null;
  opened_at: string | null;
  created_at: string;
};

export function campaignClosesAt(c: CampaignCloseInput): Date {
  if (c.deadline) return new Date(c.deadline);
  const start = new Date(c.opened_at ?? c.created_at);
  return new Date(start.getTime() + CAMPAIGN_DEFAULT_DAYS * DAY_MS);
}

/**
 * When opening/reopening a campaign, a deadline at or before `now` would make
 * the lifecycle cron close it immediately. Clear it so the default 30-day
 * window from opened_at applies. Future deadlines are kept.
 */
export function normalizeDeadlineForOpen(
  deadlineIso: string | null | undefined,
  now: Date = new Date()
): { deadline: string | null; clearedPastDeadline: boolean } {
  if (!deadlineIso) return { deadline: null, clearedPastDeadline: false };
  const at = new Date(deadlineIso);
  if (Number.isNaN(at.getTime()) || at.getTime() <= now.getTime()) {
    return { deadline: null, clearedPastDeadline: true };
  }
  return { deadline: deadlineIso, clearedPastDeadline: false };
}

/**
 * Whole days remaining until campaignClosesAt (ceil).
 * Negative when already past close; null when dates are insufficient.
 */
export function daysUntilCampaignCloses(c: {
  deadline?: string | null;
  opened_at?: string | null;
  created_at?: string | null;
}): number | null {
  const created = c.created_at || c.opened_at;
  if (!c.deadline && !created) return null;
  const closes = campaignClosesAt({
    deadline: c.deadline ?? null,
    opened_at: c.opened_at ?? null,
    created_at: created as string,
  });
  return Math.ceil((closes.getTime() - Date.now()) / DAY_MS);
}
