/** Pure helpers for unanswered-application SLA (Q5). */

export const PENDING_APPS_REMINDER_AGE_DAYS = 3;
export const PENDING_APPS_REMINDER_COOLDOWN_DAYS = 3;

export function oldestPendingAgeDays(oldestCreatedAt: string | null | undefined, nowMs = Date.now()): number {
  if (!oldestCreatedAt) return 0;
  const t = new Date(oldestCreatedAt).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((nowMs - t) / (24 * 60 * 60 * 1000)));
}

export function pendingAppsSlaLabel(
  lang: "el" | "en",
  pendingCount: number,
  oldestDays: number
): string | null {
  if (pendingCount <= 0) return null;
  if (lang === "el") {
    return `${pendingCount} αναπάντητες αιτήσεις · παλαιότερη ${oldestDays} ημέρες`;
  }
  const apps = pendingCount === 1 ? "application" : "applications";
  const dayWord = oldestDays === 1 ? "day" : "days";
  return `${pendingCount} unanswered ${apps} · oldest ${oldestDays} ${dayWord}`;
}

/** True when a brand reminder may fire (pending older than ageDays and stamp cooled down). */
export function shouldSendPendingAppsReminder(opts: {
  pendingOlderThanAge: number;
  lastSentAt: string | null | undefined;
  nowMs?: number;
  ageDays?: number;
  cooldownDays?: number;
}): boolean {
  const ageDays = opts.ageDays ?? PENDING_APPS_REMINDER_AGE_DAYS;
  const cooldownDays = opts.cooldownDays ?? PENDING_APPS_REMINDER_COOLDOWN_DAYS;
  if (opts.pendingOlderThanAge <= 0) return false;
  if (!opts.lastSentAt) return true;
  const last = new Date(opts.lastSentAt).getTime();
  if (!Number.isFinite(last)) return true;
  const now = opts.nowMs ?? Date.now();
  return now - last >= cooldownDays * 24 * 60 * 60 * 1000;
}

/** Zero-recipient alert gate (Q1): non-test campaign with no in-app / strong email / category queue. */
export function isZeroCreatorReach(counts: {
  testBrand: boolean;
  inApp: number;
  emailed: number;
  categoryQueued: number;
}): boolean {
  if (counts.testBrand) return false;
  return (counts.inApp || 0) + (counts.emailed || 0) + (counts.categoryQueued || 0) === 0;
}
