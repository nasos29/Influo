/** Pure helpers for admin per-creator statistics. */

import {
  addAthensYmdDays,
  athensTodayYmd,
  athensYmdFromIso,
  athensDayStartIso,
} from "@/lib/adminPlatformStats";

export function isSocialOutboundProfileClick(event: {
  event_type: string;
  metadata?: unknown;
}): boolean {
  if (event.event_type !== "profile_click") return false;
  const m = event.metadata as Record<string, unknown> | null | undefined;
  return !!m && typeof m === "object" && m.source === "social_outbound";
}

export function proposalBudgetAmount(p: {
  budget?: string | number | null;
  counter_proposal_budget?: string | number | null;
}): number {
  const raw = p.counter_proposal_budget ?? p.budget ?? "0";
  const n = parseFloat(String(raw));
  return Number.isFinite(n) ? n : 0;
}

export function filterByCreatedAt<T extends { created_at: string }>(
  rows: T[],
  startIso: string | null,
  endIso: string | null
): T[] {
  const t0 = startIso ? Date.parse(startIso) : NaN;
  const t1 = endIso ? Date.parse(endIso) : NaN;
  return rows.filter((row) => {
    const t = Date.parse(row.created_at);
    if (!Number.isFinite(t)) return false;
    if (Number.isFinite(t0) && t < t0) return false;
    if (Number.isFinite(t1) && t >= t1) return false;
    return true;
  });
}

export type DailyTrafficPoint = { date: string; views: number; clicks: number };

export type ProfileAnalyticsAggregate = {
  profileViews: number;
  profileClicksInfluo: number;
  socialOutboundClicks: number;
  socialOutboundByPlatform: Record<string, number>;
  daily: DailyTrafficPoint[];
};

export function aggregateProfileAnalytics(
  rows: { event_type: string; created_at: string; metadata?: unknown }[],
  dayKeys?: string[] | null
): ProfileAnalyticsAggregate {
  const socialOutboundByPlatform: Record<string, number> = {};
  let profileViews = 0;
  let profileClicksInfluo = 0;
  let socialOutboundClicks = 0;

  const dailyMap = new Map<string, { views: number; clicks: number }>();
  if (dayKeys?.length) {
    for (const d of dayKeys) dailyMap.set(d, { views: 0, clicks: 0 });
  }

  for (const row of rows) {
    const day = athensYmdFromIso(row.created_at);
    if (row.event_type === "profile_view") {
      profileViews += 1;
      if (day) {
        const bucket = dailyMap.get(day) ?? { views: 0, clicks: 0 };
        bucket.views += 1;
        dailyMap.set(day, bucket);
      }
    } else if (row.event_type === "profile_click") {
      if (isSocialOutboundProfileClick(row)) {
        socialOutboundClicks += 1;
        const m = row.metadata as Record<string, unknown> | undefined;
        const p = typeof m?.platform === "string" ? m.platform.toLowerCase() : "unknown";
        socialOutboundByPlatform[p] = (socialOutboundByPlatform[p] ?? 0) + 1;
      } else {
        profileClicksInfluo += 1;
        if (day) {
          const bucket = dailyMap.get(day) ?? { views: 0, clicks: 0 };
          bucket.clicks += 1;
          dailyMap.set(day, bucket);
        }
      }
    }
  }

  const daily =
    dayKeys?.length
      ? dayKeys.map((date) => ({
          date,
          views: dailyMap.get(date)?.views ?? 0,
          clicks: dailyMap.get(date)?.clicks ?? 0,
        }))
      : [...dailyMap.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, v]) => ({ date, views: v.views, clicks: v.clicks }));

  return {
    profileViews,
    profileClicksInfluo,
    socialOutboundClicks,
    socialOutboundByPlatform,
    daily,
  };
}

/** Inclusive Athens calendar days for `[start, end)` — matches `gte`/`lt` filters. */
export function athensDayKeysInRange(startIso: string, endExclusiveIso: string): string[] {
  const startYmd = athensYmdFromIso(startIso);
  const endExclusiveYmd = athensYmdFromIso(endExclusiveIso);
  if (!startYmd || !endExclusiveYmd) return [];

  const boundaryStart = athensDayStartIso(endExclusiveYmd);
  const atDayStart =
    Number.isFinite(Date.parse(endExclusiveIso)) &&
    Math.abs(Date.parse(boundaryStart) - Date.parse(endExclusiveIso)) < 2000;
  const endYmd = atDayStart ? addAthensYmdDays(endExclusiveYmd, -1) : endExclusiveYmd;
  if (!endYmd || startYmd > endYmd) return [];
  const out: string[] = [];
  let cur = startYmd;
  while (cur <= endYmd) {
    out.push(cur);
    if (cur === endYmd) break;
    cur = addAthensYmdDays(cur, 1);
  }
  return out;
}

/** Default reporting window: last 30 Athens days ending tomorrow 00:00. */
export function defaultInfluencerStatsPeriod(now = new Date()): { start: string; end: string } {
  const todayYmd = athensTodayYmd(now);
  const end = athensDayStartIso(addAthensYmdDays(todayYmd, 1));
  const start = athensDayStartIso(addAthensYmdDays(todayYmd, -30));
  return { start, end };
}

export function parsePlatformAccount(row: unknown): {
  platform: string;
  followers: number;
  engagement_rate: string;
  avg_likes: string;
} | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const platform = String(r.platform || "").trim();
  if (!platform) return null;
  const followersRaw = r.followers;
  let followers = 0;
  if (typeof followersRaw === "number") followers = followersRaw;
  else if (followersRaw != null) {
    const n = parseFloat(String(followersRaw).replace(/,/g, ""));
    if (Number.isFinite(n)) followers = n;
  }
  return {
    platform,
    followers: Math.max(0, Math.round(followers)),
    engagement_rate: String(r.engagement_rate ?? "").trim(),
    avg_likes: String(r.avg_likes ?? "").trim(),
  };
}