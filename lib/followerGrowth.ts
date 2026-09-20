export type FollowerGrowthPoint = {
  date: string;
  followers: number;
  change: number;
  growthPct: number;
};

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
