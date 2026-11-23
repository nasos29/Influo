import { athensYmd } from '@/lib/athensCalendar';

export function unapprovedAdminAlertDedupeKey(influencerId: string, reason: string): string {
  return `${influencerId}|${(reason || 'Άγνωστος λόγος').slice(0, 500)}`;
}

/** True when any prior alert log row falls on the same Europe/Athens calendar day as `now`. */
export function unapprovedAdminAlertAlreadyToday(
  prior: Array<{ created_at: string }>,
  now: Date = new Date()
): boolean {
  const today = athensYmd(now);
  return prior.some((row) => athensYmd(new Date(row.created_at)) === today);
}