/**
 * Pure helpers for polite, rate-limited brand campaign reminders.
 * Quiet window: 10:00–19:00 Europe/Athens. Reminder kinds share a 7-day brand cap;
 * event kinds are exempt but deduped once per campaign.
 */

export const BRAND_REMINDER_KINDS = {
  draftDay3: "draft_day3",
  draftDay10: "draft_day10",
  noCampaignNudge: "no_campaign_nudge",
  targetReached: "target_reached",
  campaignClosed: "campaign_closed",
} as const;

export type BrandReminderKind = (typeof BRAND_REMINDER_KINDS)[keyof typeof BRAND_REMINDER_KINDS];

/** Reminder-type kinds that share the global 1-per-brand-per-7-days cap. */
export const REMINDER_RATE_LIMIT_KINDS: ReadonlySet<string> = new Set([
  BRAND_REMINDER_KINDS.draftDay3,
  BRAND_REMINDER_KINDS.draftDay10,
  BRAND_REMINDER_KINDS.noCampaignNudge,
]);

export const EVENT_KINDS: ReadonlySet<string> = new Set([
  BRAND_REMINDER_KINDS.targetReached,
  BRAND_REMINDER_KINDS.campaignClosed,
]);

export const DRAFT_FIRST_DAYS = 3;
export const DRAFT_SECOND_DAYS = 10;
export const GLOBAL_REMINDER_GAP_DAYS = 7;
export const NUDGE_GAP_DAYS = 7;
export const NUDGE_MAX_STREAK = 4;
/** Skip no-campaign nudge if the brand created any campaign within this window. */
export const RECENT_CAMPAIGN_SKIP_DAYS = 14;
/** Only emit closed-event mail for campaigns closed within this window (avoids historical spam). */
export const CLOSED_EVENT_LOOKBACK_DAYS = 14;
export const QUIET_START_HOUR_ATHENS = 10;
export const QUIET_END_HOUR_ATHENS = 19;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isBrandRemindersEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return /^(1|true|yes)$/i.test(String(env.BRAND_CAMPAIGN_REMINDERS_ENABLED || "").trim());
}

/** When false (default), real brand addresses are never used — only the test recipient. */
export function isBrandRemindersLive(env: NodeJS.ProcessEnv = process.env): boolean {
  return /^(1|true|yes)$/i.test(String(env.BRAND_CAMPAIGN_REMINDERS_LIVE || "").trim());
}

/**
 * Weekly no-campaign nudge via Zoho Campaigns (bulk). Default OFF.
 * When ON, Resend path skips `no_campaign_nudge` (events/drafts stay on Resend).
 */
export function isBrandWeeklyNudgeZohoEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return /^(1|true|yes)$/i.test(String(env.BRAND_WEEKLY_NUDGE_ZOHO_ENABLED || "").trim());
}

/** Live Zoho weekly nudge (real brand emails). Falls back to BRAND_CAMPAIGN_REMINDERS_LIVE. */
export function isBrandWeeklyNudgeZohoLive(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = String(env.BRAND_WEEKLY_NUDGE_ZOHO_LIVE || "").trim();
  if (raw) return /^(1|true|yes)$/i.test(raw);
  return isBrandRemindersLive(env);
}

export function brandRemindersTestRecipient(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.BRAND_CAMPAIGN_REMINDERS_TEST_RECIPIENT ||
    env.ADMIN_EMAIL ||
    "nd.6@hotmail.com"
  )
    .trim()
    .toLowerCase();
}

/** Athens local hour (0–23) for a UTC instant. */
export function athensHour(nowMs = Date.now()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Athens",
    hour: "numeric",
    hour12: false,
  }).formatToParts(new Date(nowMs));
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  return Number.isFinite(hour) ? hour % 24 : 0;
}

/** Inclusive start, exclusive end: [10, 19) Athens. */
export function isWithinQuietSendWindow(nowMs = Date.now()): boolean {
  const h = athensHour(nowMs);
  return h >= QUIET_START_HOUR_ATHENS && h < QUIET_END_HOUR_ATHENS;
}

export function ageDays(fromIso: string | null | undefined, nowMs = Date.now()): number | null {
  if (!fromIso) return null;
  const t = Date.parse(fromIso);
  if (!Number.isFinite(t)) return null;
  return (nowMs - t) / DAY_MS;
}

/** Which draft reminder is due (max 2: day 3 then day 10), or null. */
export function draftReminderDue(input: {
  status: string | null | undefined;
  createdAt: string | null | undefined;
  sentKinds: Iterable<string>;
  nowMs?: number;
}): typeof BRAND_REMINDER_KINDS.draftDay3 | typeof BRAND_REMINDER_KINDS.draftDay10 | null {
  if (String(input.status || "").toLowerCase() !== "draft") return null;
  const age = ageDays(input.createdAt, input.nowMs);
  if (age == null) return null;
  const sent = new Set(input.sentKinds);
  if (age >= DRAFT_SECOND_DAYS && !sent.has(BRAND_REMINDER_KINDS.draftDay10)) {
    return BRAND_REMINDER_KINDS.draftDay10;
  }
  if (age >= DRAFT_FIRST_DAYS && !sent.has(BRAND_REMINDER_KINDS.draftDay3)) {
    return BRAND_REMINDER_KINDS.draftDay3;
  }
  return null;
}

export function brandOptedOutOfReminders(row: {
  reminders_email?: boolean | null;
  reminders_email_opted_out?: boolean | null;
  announcements_email?: boolean | null;
  announcements_email_opted_out?: boolean | null;
}): boolean {
  // New prefs: reminders_email=false. Legacy: either reminders or announcements opt-out.
  if (row.reminders_email === false) return true;
  if (row.reminders_email === true) return false;
  return row.reminders_email_opted_out === true || row.announcements_email_opted_out === true;
}

/** Event emails still skip hard announcement opt-out. */
export function brandOptedOutOfAnnouncementMail(row: {
  announcements_email?: boolean | null;
  announcements_email_opted_out?: boolean | null;
}): boolean {
  if (row.announcements_email === false) return true;
  if (row.announcements_email === true) return false;
  return row.announcements_email_opted_out === true;
}

export function hasRecentReminderRateLimit(
  reminderLogs: Array<{ kind: string; created_at: string }>,
  nowMs = Date.now(),
  gapDays = GLOBAL_REMINDER_GAP_DAYS
): boolean {
  const cutoff = nowMs - gapDays * DAY_MS;
  return reminderLogs.some(
    (row) => REMINDER_RATE_LIMIT_KINDS.has(row.kind) && Date.parse(row.created_at) >= cutoff
  );
}

/**
 * Unanswered nudge streak: consecutive no_campaign_nudge rows after the brand's
 * last campaign creation (or all nudges if they never created one).
 */
export function unansweredNudgeStreak(
  nudgeAts: string[],
  lastCampaignCreatedAt: string | null | undefined,
  nowMs = Date.now()
): number {
  const sinceMs = lastCampaignCreatedAt ? Date.parse(lastCampaignCreatedAt) : 0;
  const since = Number.isFinite(sinceMs) ? sinceMs : 0;
  return nudgeAts.filter((iso) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) && t > since && t <= nowMs;
  }).length;
}

export function noCampaignNudgeDue(input: {
  hasOpenCampaign: boolean;
  lastCampaignCreatedAt: string | null | undefined;
  nudgeAts: string[];
  nowMs?: number;
}): boolean {
  const nowMs = input.nowMs ?? Date.now();
  if (input.hasOpenCampaign) return false;
  const recentAge = ageDays(input.lastCampaignCreatedAt, nowMs);
  if (recentAge != null && recentAge < RECENT_CAMPAIGN_SKIP_DAYS) return false;
  const streak = unansweredNudgeStreak(input.nudgeAts, input.lastCampaignCreatedAt, nowMs);
  if (streak >= NUDGE_MAX_STREAK) return false;
  if (streak > 0) {
    const last = input.nudgeAts
      .map((iso) => Date.parse(iso))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)[0];
    if (last != null && nowMs - last < NUDGE_GAP_DAYS * DAY_MS) return false;
  }
  return true;
}

export function resolveSendTo(
  realEmail: string,
  env: NodeJS.ProcessEnv = process.env
): { to: string; redirected: boolean } {
  const live = isBrandRemindersLive(env);
  const real = realEmail.trim().toLowerCase();
  if (live) return { to: real, redirected: false };
  return { to: brandRemindersTestRecipient(env), redirected: true };
}
