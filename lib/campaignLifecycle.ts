export const CAMPAIGN_DEFAULT_DAYS = 7;
/** Pre-cutoff opens (no deadline) keep the old 30-day window. */
export const CAMPAIGN_LEGACY_DEFAULT_DAYS = 30;
/** After the 30-day cutoff and through CAMPAIGN_SEVEN_DAY_CUTOFF_ISO, no-deadline opens use this many days. */
export const CAMPAIGN_INTERIM_DEFAULT_DAYS = 15;
/**
 * Campaigns opened at/before this instant without a deadline keep
 * CAMPAIGN_LEGACY_DEFAULT_DAYS. New opens (and reopens) after the interim cutoff use
 * CAMPAIGN_DEFAULT_DAYS (or an admin-tuned override via opts.defaultDays).
 */
export const CAMPAIGN_DEFAULT_DAYS_CUTOFF_ISO = "2026-11-08T18:00:00.000Z";
/**
 * No-deadline opens after CAMPAIGN_DEFAULT_DAYS_CUTOFF_ISO and at/before this instant
 * keep CAMPAIGN_INTERIM_DEFAULT_DAYS. Opens after this instant use CAMPAIGN_DEFAULT_DAYS.
 */
export const CAMPAIGN_SEVEN_DAY_CUTOFF_ISO = "2026-11-24T12:00:00.000Z";
export const CAMPAIGN_REMINDER_DAYS_BEFORE = 3;

export const APPLICATION_WINDOW_DAYS = [3, 7, 14] as const;
export type ApplicationWindowDays = (typeof APPLICATION_WINDOW_DAYS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;
const CUTOFF_MS = new Date(CAMPAIGN_DEFAULT_DAYS_CUTOFF_ISO).getTime();
const SEVEN_DAY_CUTOFF_MS = new Date(CAMPAIGN_SEVEN_DAY_CUTOFF_ISO).getTime();

export type CampaignCloseInput = {
  deadline: string | null;
  opened_at: string | null;
  created_at: string;
};

export type CampaignCloseOptions = {
  /** Override for post-interim-cutoff default window (from site settings). */
  defaultDays?: number;
};

function defaultDaysForOpenStart(start: Date, defaultDays = CAMPAIGN_DEFAULT_DAYS): number {
  const t = start.getTime();
  if (t <= CUTOFF_MS) return CAMPAIGN_LEGACY_DEFAULT_DAYS;
  if (t <= SEVEN_DAY_CUTOFF_MS) return CAMPAIGN_INTERIM_DEFAULT_DAYS;
  return defaultDays;
}

export function campaignClosesAt(
  c: CampaignCloseInput,
  opts?: CampaignCloseOptions
): Date {
  if (c.deadline) return new Date(c.deadline);
  const start = new Date(c.opened_at ?? c.created_at);
  const days = defaultDaysForOpenStart(start, opts?.defaultDays ?? CAMPAIGN_DEFAULT_DAYS);
  return new Date(start.getTime() + days * DAY_MS);
}

/** Parse brand-selected application window (3 / 7 / 14 days); default 7. */
export function parseApplicationWindowDays(value: unknown): ApplicationWindowDays {
  const n = typeof value === "number" ? value : parseInt(String(value ?? "").trim(), 10);
  if (n === 3 || n === 7 || n === 14) return n;
  return 7;
}

/** Deadline instant = opened_at + N×24h (not date-only noon). */
export function deadlineFromOpenedAt(openedAtIso: string, days: number): string {
  return new Date(new Date(openedAtIso).getTime() + days * DAY_MS).toISOString();
}

export type ResolveSaveDeadlineInput = {
  status: string;
  openingNow: boolean;
  wasOpen: boolean;
  existingDeadline: string | null | undefined;
  openAnchorIso: string | null;
  windowDays: number;
  draftAnchor: string | null;
};

/**
 * Campaign save payload deadline. Legacy no-deadline open rows stay null on
 * stay-open edits; new opens and reopens set opened_at + window days.
 */
export function resolveSaveDeadlineIso(input: ResolveSaveDeadlineInput): string | null {
  if (input.status === "open" && input.openAnchorIso) {
    if (input.wasOpen && !input.openingNow && input.existingDeadline == null) {
      return null;
    }
    return deadlineFromOpenedAt(input.openAnchorIso, input.windowDays);
  }
  if (input.status === "draft" && input.draftAnchor) {
    return deadlineFromOpenedAt(input.draftAnchor, input.windowDays);
  }
  return null;
}

/** Infer picker value when editing an existing row. */
export function inferApplicationWindowDays(
  deadline: string | null | undefined,
  openedAt: string | null | undefined,
  createdAt: string | null | undefined
): ApplicationWindowDays {
  if (!deadline) return 7;
  const start = openedAt ?? createdAt;
  if (!start) return 7;
  const diffMs = new Date(deadline).getTime() - new Date(start).getTime();
  const days = Math.round(diffMs / DAY_MS);
  if (days === 3 || days === 7 || days === 14) return days;
  return 7;
}

/** False when status is not open or effective close time has passed. */
export function isCampaignAcceptingApplications(
  c: CampaignCloseInput & { status: string },
  now: Date = new Date(),
  opts?: CampaignCloseOptions
): boolean {
  if (c.status !== "open") return false;
  const closes = campaignClosesAt(c, opts);
  return now.getTime() < closes.getTime();
}

/**
 * When opening/reopening a campaign, a deadline at or before `now` would make
 * the lifecycle cron close it immediately. Clear it so the default window
 * from opened_at applies. Future deadlines are kept.
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
export function daysUntilCampaignCloses(
  c: {
    deadline?: string | null;
    opened_at?: string | null;
    created_at?: string | null;
  },
  opts?: CampaignCloseOptions
): number | null {
  const created = c.created_at || c.opened_at;
  if (!c.deadline && !created) return null;
  const closes = campaignClosesAt(
    {
      deadline: c.deadline ?? null,
      opened_at: c.opened_at ?? null,
      created_at: created as string,
    },
    opts
  );
  return Math.ceil((closes.getTime() - Date.now()) / DAY_MS);
}