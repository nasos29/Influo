/** Pure helpers for admin platform-wide statistics (Europe/Athens day buckets). */

export const ATHENS = "Europe/Athens";

export type PeriodKpi = {
  today: number;
  d7: number;
  prev7: number;
  d30: number;
  prev30: number;
  total?: number;
};

export type StatsPeriodBounds = {
  todayYmd: string;
  todayStart: string;
  tomorrowStart: string;
  d7Start: string;
  prev7Start: string;
  prev7End: string;
  d30Start: string;
  prev30Start: string;
  prev30End: string;
  dayKeys30: string[];
};

function athensWallParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ATHENS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    y: n("year"),
    m: n("month"),
    d: n("day"),
    h: n("hour"),
    min: n("minute"),
    s: n("second"),
  };
}

function ymdFromParts(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Today's calendar date in Europe/Athens (YYYY-MM-DD). */
export function athensTodayYmd(now = new Date()): string {
  const { y, m, d } = athensWallParts(now);
  return ymdFromParts(y, m, d);
}

/** Civil calendar day in Athens for an ISO instant. */
export function athensYmdFromIso(iso: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return athensTodayYmd(new Date(t));
}

/** UTC instant when the Athens wall clock is 00:00:00 on `ymd`. */
export function athensDayStartIso(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  let lo = Date.UTC(y, m - 1, d - 1, 0, 0, 0);
  let hi = Date.UTC(y, m - 1, d + 1, 23, 59, 59);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const p = athensWallParts(new Date(mid));
    const key = ymdFromParts(p.y, p.m, p.d);
    const score = p.h * 3600 + p.min * 60 + p.s;
    if (key < ymd || (key === ymd && score < 0)) lo = mid + 1000;
    else hi = mid;
  }
  let t = lo;
  for (let i = 0; i < 86_400; i += 1) {
    const p = athensWallParts(new Date(t));
    const key = ymdFromParts(p.y, p.m, p.d);
    if (key === ymd && p.h === 0 && p.min === 0 && p.s === 0) {
      return new Date(t).toISOString();
    }
    t += 1000;
  }
  return new Date(lo).toISOString();
}

export function addAthensYmdDays(ymd: string, delta: number): string {
  const base = Date.parse(athensDayStartIso(ymd));
  return athensTodayYmd(new Date(base + delta * 86_400_000));
}

export function lastNDayKeys(endYmd: string, n: number): string[] {
  const out: string[] = [];
  let cur = endYmd;
  for (let i = 0; i < n; i += 1) {
    out.unshift(cur);
    cur = addAthensYmdDays(cur, -1);
  }
  return out;
}

export function buildStatsPeriodBounds(now = new Date()): StatsPeriodBounds {
  const todayYmd = athensTodayYmd(now);
  const todayStart = athensDayStartIso(todayYmd);
  const tomorrowStart = athensDayStartIso(addAthensYmdDays(todayYmd, 1));
  const t0 = Date.parse(todayStart);
  const isoOffset = (days: number) => new Date(t0 + days * 86_400_000).toISOString();
  return {
    todayYmd,
    todayStart,
    tomorrowStart,
    d7Start: isoOffset(-7),
    prev7Start: isoOffset(-14),
    prev7End: isoOffset(-7),
    d30Start: isoOffset(-30),
    prev30Start: isoOffset(-60),
    prev30End: isoOffset(-30),
    dayKeys30: lastNDayKeys(todayYmd, 30),
  };
}

export function changePct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? null : 100;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function splitDelimitedLabels(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function aggregateTopLabels(labels: string[], limit = 12): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const label of labels) {
    const key = label.trim();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export function bucketSignupsByDay(
  influencerDates: string[],
  brandDates: string[],
  dayKeys: string[]
): { date: string; creators: number; brands: number }[] {
  const creators = new Map(dayKeys.map((d) => [d, 0]));
  const brands = new Map(dayKeys.map((d) => [d, 0]));
  for (const iso of influencerDates) {
    const d = athensYmdFromIso(iso);
    if (d && creators.has(d)) creators.set(d, (creators.get(d) ?? 0) + 1);
  }
  for (const iso of brandDates) {
    const d = athensYmdFromIso(iso);
    if (d && brands.has(d)) brands.set(d, (brands.get(d) ?? 0) + 1);
  }
  return dayKeys.map((date) => ({
    date,
    creators: creators.get(date) ?? 0,
    brands: brands.get(date) ?? 0,
  }));
}

export type DateRange = { gte: string; lt: string };

/** Classify `created_at` into period KPI fields (inclusive gte, exclusive lt). */
export function countInPeriods(createdAt: string, bounds: StatsPeriodBounds): Partial<Record<keyof PeriodKpi, 1>> {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return {};
  const out: Partial<Record<keyof PeriodKpi, 1>> = {};
  const t0 = Date.parse(bounds.todayStart);
  const t1 = Date.parse(bounds.tomorrowStart);
  const d7 = Date.parse(bounds.d7Start);
  const p7s = Date.parse(bounds.prev7Start);
  const p7e = Date.parse(bounds.prev7End);
  const d30 = Date.parse(bounds.d30Start);
  const p30s = Date.parse(bounds.prev30Start);
  const p30e = Date.parse(bounds.prev30End);

  if (t >= t0 && t < t1) out.today = 1;
  if (t >= d7 && t < t1) out.d7 = 1;
  if (t >= p7s && t < p7e) out.prev7 = 1;
  if (t >= d30 && t < t1) out.d30 = 1;
  if (t >= p30s && t < p30e) out.prev30 = 1;
  return out;
}

export function emptyPeriodKpi(): PeriodKpi {
  return { today: 0, d7: 0, prev7: 0, d30: 0, prev30: 0 };
}

export function bumpKpi(target: PeriodKpi, flags: Partial<Record<keyof PeriodKpi, 1>>) {
  for (const key of ["today", "d7", "prev7", "d30", "prev30"] as const) {
    if (flags[key]) target[key] += 1;
  }
}

export function avgOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, n) => a + n, 0);
  return Math.round((sum / values.length) * 100) / 100;
}