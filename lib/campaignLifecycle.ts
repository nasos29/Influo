export const CAMPAIGN_DEFAULT_DAYS = 30;
export const CAMPAIGN_REMINDER_DAYS_BEFORE = 3;

export function campaignClosesAt(c: {
  deadline: string | null;
  opened_at: string | null;
  created_at: string;
}): Date {
  if (c.deadline) return new Date(c.deadline);
  const start = new Date(c.opened_at ?? c.created_at);
  return new Date(start.getTime() + CAMPAIGN_DEFAULT_DAYS * 24 * 60 * 60 * 1000);
}
