import {
  alignFollowerSnapshotToCurrent,
  compactSnapshotAccounts,
} from "@/lib/parseFollowers";

export type FollowerGrowthPoint = {
  date: string;
  followers: number;
  change: number;
  growthPct: number;
};

/** Compact per-account row stored on influencer_follower_snapshots.accounts. */
export type SnapshotAccountFollowers = {
  platform: string;
  username: string;
  followers: number;
};

export type FollowerSnapshotPoint = {
  total: number;
  at: number;
  accounts?: SnapshotAccountFollowers[] | null;
};

export type FollowerGrowthResult = {
  currentTotal: number;
  oldTotal: number;
  growth: number;
  growthPct: number;
  /** Snapshots in the same account-composition era (for the chart). */
  seriesSource: FollowerSnapshotPoint[];
};

/** Window for profile "follower change" card / % — matches social-refresh cadence. */
export const FOLLOWER_GROWTH_WINDOW_DAYS = 15;

/** Sudden total drops between refreshes that look like a removed account, not organic churn. */
const COMPOSITION_BREAK_MIN_DROP = 1500;
const COMPOSITION_BREAK_MIN_PCT = 0.12;

function ymdLocal(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDay(date: string): number {
  return Date.parse(`${date}T12:00:00Z`);
}

export function addUtcDays(date: string, days: number): string {
  const ms = parseDay(date) + days * 86400000;
  return ymdLocal(ms);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b) - parseDay(a)) / 86400000);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Build compact snapshot account rows from a live influencer.accounts array. */
export function snapshotAccountsFromProfile(
  accounts:
    | Array<{
        platform?: string | null;
        username?: string | null;
        followers?: string | number | null;
      }>
    | null
    | undefined
): SnapshotAccountFollowers[] {
  return compactSnapshotAccounts(accounts);
}

export function isFollowerCompositionBreak(prevTotal: number, nextTotal: number): boolean {
  if (!(prevTotal > 0) || !(nextTotal > 0) || nextTotal >= prevTotal) return false;
  const drop = prevTotal - nextTotal;
  return drop >= COMPOSITION_BREAK_MIN_DROP && drop / prevTotal >= COMPOSITION_BREAK_MIN_PCT;
}

/**
 * Sum followers only for accounts present on both sides (same platform+username).
 * Falls back to unique platform match when username changed but one account per platform.
 */
export function matchedFollowerTotals(
  current: SnapshotAccountFollowers[],
  baseline: SnapshotAccountFollowers[]
): { current: number; baseline: number; matched: number } | null {
  if (!current.length || !baseline.length) return null;

  const baselineByKey = new Map<string, SnapshotAccountFollowers>();
  const baselineByPlatform = new Map<string, SnapshotAccountFollowers[]>();
  for (const row of baseline) {
    baselineByKey.set(`${row.platform}:${row.username}`, row);
    const list = baselineByPlatform.get(row.platform) || [];
    list.push(row);
    baselineByPlatform.set(row.platform, list);
  }

  let currentSum = 0;
  let baselineSum = 0;
  let matched = 0;
  for (const row of current) {
    const exact = baselineByKey.get(`${row.platform}:${row.username}`);
    if (exact) {
      currentSum += row.followers;
      baselineSum += exact.followers;
      matched += 1;
      continue;
    }
    const samePlatform = baselineByPlatform.get(row.platform) || [];
    if (samePlatform.length === 1) {
      currentSum += row.followers;
      baselineSum += samePlatform[0].followers;
      matched += 1;
    }
  }
  if (!matched || !(baselineSum > 0) || !(currentSum > 0)) return null;
  return { current: currentSum, baseline: baselineSum, matched };
}

/**
 * Pick a 15-day baseline that ignores lost/removed accounts.
 * Prefers per-account matching; otherwise skips composition-break cliffs in totals.
 */
export function computeFollowerGrowth(
  snapshots: FollowerSnapshotPoint[],
  currentAccounts: SnapshotAccountFollowers[],
  currentTotalRaw?: number,
  now = Date.now(),
  windowDays = FOLLOWER_GROWTH_WINDOW_DAYS
): FollowerGrowthResult | null {
  const currentTotal =
    typeof currentTotalRaw === "number" && currentTotalRaw > 0
      ? Math.round(currentTotalRaw)
      : currentAccounts.reduce((sum, a) => sum + a.followers, 0);
  if (!(currentTotal > 0)) return null;

  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const minFallbackAgeMs = 7 * 24 * 60 * 60 * 1000;

  const ascending = [...snapshots]
    .filter((s) => Number.isFinite(s.at) && Number.isFinite(s.total) && s.total > 0)
    .sort((a, b) => a.at - b.at);

  // 1) Per-account match against an old enough snapshot that stored accounts.
  if (currentAccounts.length) {
    const withAccounts = [...ascending]
      .reverse()
      .filter((s) => Array.isArray(s.accounts) && s.accounts!.length > 0);
    const matchedBaseline =
      withAccounts.find((s) => now - s.at >= windowMs) ||
      withAccounts.find((s) => now - s.at >= minFallbackAgeMs) ||
      null;
    if (matchedBaseline?.accounts?.length) {
      const matched = matchedFollowerTotals(currentAccounts, matchedBaseline.accounts);
      if (matched) {
        const growth = Math.round(matched.current - matched.baseline);
        return {
          currentTotal: matched.current,
          oldTotal: matched.baseline,
          growth,
          growthPct: Math.round((growth / matched.baseline) * 1000) / 10,
          seriesSource: ascending.filter((s) => s.at >= matchedBaseline.at),
        };
      }
    }
  }

  // 2) Totals path: drop snapshots from before the latest "lost account" cliff.
  const aligned: FollowerSnapshotPoint[] = [];
  for (const s of ascending) {
    const total = alignFollowerSnapshotToCurrent(s.total, currentTotal);
    if (total == null) continue;
    aligned.push({ ...s, total });
  }
  if (!aligned.length) return null;

  let eraStartIdx = 0;
  for (let i = 1; i < aligned.length; i++) {
    if (isFollowerCompositionBreak(aligned[i - 1].total, aligned[i].total)) {
      eraStartIdx = i;
    }
  }
  const era = aligned.slice(eraStartIdx);
  const baselineWindow = [...era].reverse().find((s) => now - s.at >= windowMs);
  const fallback = era.find((s) => now - s.at >= minFallbackAgeMs) || era[0];
  const baseline = baselineWindow || fallback;
  if (!baseline || !(baseline.total > 0)) return null;

  const growth = Math.round(currentTotal - baseline.total);
  return {
    currentTotal,
    oldTotal: baseline.total,
    growth,
    growthPct: Math.round((growth / baseline.total) * 1000) / 10,
    seriesSource: era,
  };
}

/** Real snapshot points for the last `windowDays`, plus current total. */
export function buildFollowerGrowthSeries(
  snapshots: { total: number; at: number }[],
  currentTotal: number,
  now = Date.now(),
  windowDays = 90
): FollowerGrowthPoint[] {
  const cutoff = now - windowDays * 86400000;
  const byDay = new Map<string, number>();
  for (const s of [...snapshots].sort((a, b) => a.at - b.at)) {
    if (!Number.isFinite(s.at) || !Number.isFinite(s.total) || s.total <= 0) continue;
    if (s.at < cutoff) continue;
    byDay.set(ymdLocal(s.at), Math.round(s.total));
  }
  if (currentTotal > 0) {
    byDay.set(ymdLocal(now), Math.round(currentTotal));
  }

  const points = [...byDay.entries()]
    .map(([date, followers]) => ({ date, followers }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!points.length) return [];
  const start = points[0].followers;
  return points.map((p, i) => ({
    date: p.date,
    followers: p.followers,
    change: i === 0 ? 0 : p.followers - points[i - 1].followers,
    growthPct: start > 0 ? round1(((p.followers - start) / start) * 100) : 0,
  }));
}

/** Daily points for the chart. Values between snapshots are linear estimates. */
export function expandGrowthSeriesDaily(points: FollowerGrowthPoint[]): Array<FollowerGrowthPoint & { interpolated: boolean }> {
  if (points.length <= 1) {
    return points.map((p) => ({ ...p, interpolated: false }));
  }
  const start = points[0].followers;
  const out: Array<FollowerGrowthPoint & { interpolated: boolean }> = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const days = Math.max(1, daysBetween(a.date, b.date));
    for (let d = 0; d < days; d++) {
      const t = d / days;
      const followers = Math.round(a.followers + (b.followers - a.followers) * t);
      const prev = out.length ? out[out.length - 1].followers : followers;
      out.push({
        date: addUtcDays(a.date, d),
        followers,
        change: out.length ? followers - prev : 0,
        growthPct: start > 0 ? round1(((followers - start) / start) * 100) : 0,
        interpolated: d !== 0,
      });
    }
  }
  const last = points[points.length - 1];
  const prev = out[out.length - 1];
  out.push({
    date: last.date,
    followers: last.followers,
    change: prev ? last.followers - prev.followers : 0,
    growthPct: start > 0 ? round1(((last.followers - start) / start) * 100) : 0,
    interpolated: false,
  });
  return out;
}
