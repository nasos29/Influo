import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addAthensYmdDays,
  athensDayStartIso,
  athensYmdFromIso,
  buildStatsPeriodBounds,
  type PeriodKpi,
  type StatsPeriodBounds,
} from "@/lib/adminPlatformStats";
import { STATS_SWR_MS } from "@/lib/adminStatsSingleFlight";

export const STATS_REQUEST_TIMEOUT_MS = 8000;
export const OVERVIEW_CACHE_MS = STATS_SWR_MS;
export const INFLUENCER_CACHE_MS = STATS_SWR_MS;
export const QUERY_BATCH_SIZE = 8;
export const ANALYTICS_SERIES_ROW_CAP = 8000;
export const EMAIL_LOG_ROW_CAP = 500;
export const REVIEW_RATINGS_ROW_CAP = 2000;
export const INFLUENCER_ANALYTICS_ROW_CAP = 8000;
/** When range=all, bound analytics to this many Athens days back. */
export const INFLUENCER_ALL_TIME_MAX_DAYS = 365;

export type CountQuery = {
  table: string;
  dateCol?: string;
  gte?: string;
  lt?: string;
  eq?: Record<string, string | boolean | number>;
  or?: string;
  notEq?: Record<string, string | boolean>;
  metaEq?: { path: string; value: string };
  metaNeqOrNull?: { path: string; value: string };
};

export async function headCount(admin: SupabaseClient, q: CountQuery): Promise<number> {
  let query = admin.from(q.table).select("id", { count: "exact", head: true });
  if (q.dateCol && q.gte) query = query.gte(q.dateCol, q.gte);
  if (q.dateCol && q.lt) query = query.lt(q.dateCol, q.lt);
  if (q.eq) {
    for (const [k, v] of Object.entries(q.eq)) query = query.eq(k, v);
  }
  if (q.or) query = query.or(q.or);
  if (q.notEq) {
    for (const [k, v] of Object.entries(q.notEq)) query = query.neq(k, v);
  }
  if (q.metaEq) query = query.filter(`metadata->>${q.metaEq.path}`, "eq", q.metaEq.value);
  if (q.metaNeqOrNull) {
    const p = q.metaNeqOrNull.path;
    const v = q.metaNeqOrNull.value;
    query = query.or(`metadata->>${p}.neq.${v},metadata->>${p}.is.null`);
  }
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

export async function runInBatches<T>(items: (() => Promise<T>)[], batchSize = QUERY_BATCH_SIZE): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    const batch = await Promise.all(slice.map((fn) => fn()));
    out.push(...batch);
  }
  return out;
}

export async function buildPeriodKpi(
  admin: SupabaseClient,
  table: string,
  dateCol: string,
  bounds: StatsPeriodBounds,
  extra?: Omit<CountQuery, "table" | "dateCol" | "gte" | "lt">
): Promise<PeriodKpi> {
  const specs: CountQuery[] = [
    { table, dateCol, gte: bounds.todayStart, lt: bounds.tomorrowStart, ...extra },
    { table, dateCol, gte: bounds.d7Start, lt: bounds.tomorrowStart, ...extra },
    { table, dateCol, gte: bounds.prev7Start, lt: bounds.prev7End, ...extra },
    { table, dateCol, gte: bounds.d30Start, lt: bounds.tomorrowStart, ...extra },
    { table, dateCol, gte: bounds.prev30Start, lt: bounds.prev30End, ...extra },
    { table, ...extra },
  ];
  const counts = await runInBatches(specs.map((q) => () => headCount(admin, q)));
  return {
    today: counts[0] ?? 0,
    d7: counts[1] ?? 0,
    prev7: counts[2] ?? 0,
    d30: counts[3] ?? 0,
    prev30: counts[4] ?? 0,
    total: counts[5] ?? 0,
  };
}

export async function statusTotalsBatched(
  admin: SupabaseClient,
  table: string,
  statuses: string[],
  dateCol?: string,
  bounds?: StatsPeriodBounds
): Promise<Record<string, number>> {
  const fns = statuses.map((status) => async () => {
    const q: CountQuery = { table, eq: { status } };
    if (dateCol && bounds) {
      q.dateCol = dateCol;
      q.gte = bounds.d30Start;
      q.lt = bounds.tomorrowStart;
    }
    return { status, n: await headCount(admin, q) };
  });
  const rows = await runInBatches(fns);
  const out: Record<string, number> = {};
  for (const { status, n } of rows) out[status] = n;
  return out;
}

export type PagedQuery = {
  gte(column: string, value: string): PagedQuery;
  lt(column: string, value: string): PagedQuery;
  eq(column: string, value: string | boolean): PagedQuery;
  in(column: string, values: string[]): PagedQuery;
  filter(column: string, operator: string, value: string): PagedQuery;
  order(column: string, options: { ascending: boolean }): PagedQuery;
  range(from: number, to: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
};

export async function fetchCapped<T>(
  admin: SupabaseClient,
  table: string,
  select: string,
  apply: (q: PagedQuery) => PagedQuery,
  maxRows: number,
  orderCol = "created_at"
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = Math.min(1000, maxRows);
  let from = 0;
  while (rows.length < maxRows) {
    const base = admin.from(table).select(select) as unknown as PagedQuery;
    const query = apply(base);
    const limit = Math.min(pageSize, maxRows - rows.length);
    const { data, error } = await query.order(orderCol, { ascending: true }).range(from, from + limit - 1);
    if (error) break;
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < limit) break;
    from += batch.length;
  }
  return rows;
}

export async function platformAnalyticsKpis(
  admin: SupabaseClient,
  bounds: StatsPeriodBounds
): Promise<{
  profileViews: PeriodKpi;
  profileClicksInfluo: PeriodKpi;
  profileClicksSocial: PeriodKpi;
}> {
  const base = { table: "influencer_analytics" as const, dateCol: "created_at" as const };
  const viewsFn = () => buildPeriodKpi(admin, base.table, base.dateCol, bounds, { eq: { event_type: "profile_view" } });
  const socialFn = () =>
    buildPeriodKpi(admin, base.table, base.dateCol, bounds, {
      eq: { event_type: "profile_click" },
      metaEq: { path: "source", value: "social_outbound" },
    });
  const influoFn = () =>
    buildPeriodKpi(admin, base.table, base.dateCol, bounds, {
      eq: { event_type: "profile_click" },
      metaNeqOrNull: { path: "source", value: "social_outbound" },
    });
  const [profileViews, profileClicksSocial, profileClicksInfluo] = await runInBatches([viewsFn, socialFn, influoFn], 3);
  return { profileViews, profileClicksInfluo, profileClicksSocial };
}

export function analyticsDailyFromLightRows(
  rows: { event_type: string; created_at: string }[],
  bounds: StatsPeriodBounds
): { date: string; views: number; clicks: number; social: number }[] {
  const daily: Record<string, { views: number; clicks: number; social: number }> = {};
  for (const d of bounds.dayKeys30) daily[d] = { views: 0, clicks: 0, social: 0 };
  for (const row of rows) {
    const day = athensYmdFromIso(row.created_at);
    if (!day || !daily[day]) continue;
    if (row.event_type === "profile_view") daily[day].views += 1;
    else if (row.event_type === "profile_click") daily[day].clicks += 1;
  }
  return bounds.dayKeys30.map((date) => ({
    date,
    views: daily[date]?.views ?? 0,
    clicks: daily[date]?.clicks ?? 0,
    social: daily[date]?.social ?? 0,
  }));
}

const DAILY_HEAD_MAX_DAYS = 7;

function capDayKeysForHeadCounts(dayKeys: string[]): string[] {
  return dayKeys.length > DAILY_HEAD_MAX_DAYS ? dayKeys.slice(-DAILY_HEAD_MAX_DAYS) : dayKeys;
}

/** Daily profile views/clicks via head counts (no row downloads). Social split stays 0. */
export async function platformAnalyticsDailyByHead(
  admin: SupabaseClient,
  bounds: StatsPeriodBounds
): Promise<{ date: string; views: number; clicks: number; social: number }[]> {
  const activeDays = capDayKeysForHeadCounts(bounds.dayKeys30);
  const countJobs: (() => Promise<number>)[] = [];
  for (const ymd of activeDays) {
    const gte = athensDayStartIso(ymd);
    const lt = athensDayStartIso(addAthensYmdDays(ymd, 1));
    countJobs.push(() =>
      headCount(admin, {
        table: "influencer_analytics",
        dateCol: "created_at",
        gte,
        lt,
        eq: { event_type: "profile_view" },
      })
    );
    countJobs.push(() =>
      headCount(admin, {
        table: "influencer_analytics",
        dateCol: "created_at",
        gte,
        lt,
        eq: { event_type: "profile_click" },
        metaNeqOrNull: { path: "source", value: "social_outbound" },
      })
    );
  }
  const counts = await runInBatches(countJobs);
  const byDate = new Map<string, { views: number; clicks: number }>();
  for (let i = 0; i < activeDays.length; i++) {
    byDate.set(activeDays[i]!, {
      views: counts[i * 2] ?? 0,
      clicks: counts[i * 2 + 1] ?? 0,
    });
  }
  return bounds.dayKeys30.map((date) => {
    const row = byDate.get(date);
    return { date, views: row?.views ?? 0, clicks: row?.clicks ?? 0, social: 0 };
  });
}

export async function influencerAnalyticsDailyByHead(
  admin: SupabaseClient,
  influencerId: string,
  dayKeys: string[] | null
): Promise<{ date: string; views: number; clicks: number }[]> {
  if (!dayKeys?.length) return [];
  const activeDays = capDayKeysForHeadCounts(dayKeys);
  const countJobs: (() => Promise<number>)[] = [];
  for (const ymd of activeDays) {
    const gte = athensDayStartIso(ymd);
    const lt = athensDayStartIso(addAthensYmdDays(ymd, 1));
    countJobs.push(() =>
      headCount(admin, {
        table: "influencer_analytics",
        dateCol: "created_at",
        gte,
        lt,
        eq: { influencer_id: influencerId, event_type: "profile_view" },
      })
    );
    countJobs.push(() =>
      headCount(admin, {
        table: "influencer_analytics",
        dateCol: "created_at",
        gte,
        lt,
        eq: { influencer_id: influencerId, event_type: "profile_click" },
        metaNeqOrNull: { path: "source", value: "social_outbound" },
      })
    );
  }
  const counts = await runInBatches(countJobs);
  const byDate = new Map<string, { views: number; clicks: number }>();
  for (let i = 0; i < activeDays.length; i++) {
    byDate.set(activeDays[i]!, {
      views: counts[i * 2] ?? 0,
      clicks: counts[i * 2 + 1] ?? 0,
    });
  }
  return dayKeys.map((date) => {
    const row = byDate.get(date);
    return { date, views: row?.views ?? 0, clicks: row?.clicks ?? 0 };
  });
}

export async function influencerPeriodAnalyticsTotals(
  admin: SupabaseClient,
  influencerId: string,
  start: string | null,
  end: string | null
): Promise<{ profileViews: number; profileClicksInfluo: number; socialOutboundClicks: number }> {
  const withWindow = (eventType: string, meta?: Pick<CountQuery, "metaEq" | "metaNeqOrNull">): CountQuery => {
    const q: CountQuery = {
      table: "influencer_analytics",
      eq: { influencer_id: influencerId, event_type: eventType },
      ...meta,
    };
    if (start) {
      q.dateCol = "created_at";
      q.gte = start;
    }
    if (end) {
      q.dateCol = q.dateCol ?? "created_at";
      q.lt = end;
    }
    return q;
  };
  const [profileViews, socialOutboundClicks, profileClicksInfluo] = await runInBatches(
    [
      () => headCount(admin, withWindow("profile_view")),
      () => headCount(admin, withWindow("profile_click", { metaEq: { path: "source", value: "social_outbound" } })),
      () =>
        headCount(
          admin,
          withWindow("profile_click", { metaNeqOrNull: { path: "source", value: "social_outbound" } })
        ),
    ],
    3
  );
  return { profileViews, profileClicksInfluo, socialOutboundClicks };
}

export function boundInfluencerAllTimeRange(): { start: string; end: string } {
  const bounds = buildStatsPeriodBounds();
  const end = bounds.tomorrowStart;
  const start = new Date(Date.parse(bounds.todayStart) - INFLUENCER_ALL_TIME_MAX_DAYS * 86_400_000).toISOString();
  return { start, end };
}
