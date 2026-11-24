import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rejectUnlessAdmin, supabaseService } from "@/lib/apiAuth";
import { isProtectedTestAccount } from "@/lib/protectedAccount";
import {
  aggregateTopLabels,
  athensYmdFromIso,
  bucketSignupsByDay,
  buildStatsPeriodBounds,
  bumpKpi,
  countInPeriods,
  emptyPeriodKpi,
  splitDelimitedLabels,
  type PeriodKpi,
  type StatsPeriodBounds,
} from "@/lib/adminPlatformStats";

const CACHE_HEADERS = { "Cache-Control": "private, no-store" };

type CountQuery = {
  table: string;
  dateCol?: string;
  gte?: string;
  lt?: string;
  eq?: Record<string, string | boolean | number>;
  or?: string;
  notEq?: Record<string, string | boolean>;
};

async function headCount(admin: SupabaseClient, q: CountQuery): Promise<number> {
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
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

async function buildPeriodKpi(
  admin: SupabaseClient,
  table: string,
  dateCol: string,
  bounds: StatsPeriodBounds,
  extra?: Omit<CountQuery, "table" | "dateCol" | "gte" | "lt">
): Promise<PeriodKpi> {
  const [today, d7, prev7, d30, prev30, total] = await Promise.all([
    headCount(admin, { table, dateCol, gte: bounds.todayStart, lt: bounds.tomorrowStart, ...extra }),
    headCount(admin, { table, dateCol, gte: bounds.d7Start, lt: bounds.tomorrowStart, ...extra }),
    headCount(admin, { table, dateCol, gte: bounds.prev7Start, lt: bounds.prev7End, ...extra }),
    headCount(admin, { table, dateCol, gte: bounds.d30Start, lt: bounds.tomorrowStart, ...extra }),
    headCount(admin, { table, dateCol, gte: bounds.prev30Start, lt: bounds.prev30End, ...extra }),
    headCount(admin, { table, ...extra }),
  ]);
  return { today, d7, prev7, d30, prev30, total };
}

async function statusTotals(
  admin: SupabaseClient,
  table: string,
  statuses: string[],
  dateCol?: string,
  bounds?: StatsPeriodBounds
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(
    statuses.map(async (status) => {
      const q: CountQuery = { table, eq: { status } };
      if (dateCol && bounds) {
        q.dateCol = dateCol;
        q.gte = bounds.d30Start;
        q.lt = bounds.tomorrowStart;
      }
      out[status] = await headCount(admin, q);
    })
  );
  return out;
}

type PagedQuery = {
  gte(column: string, value: string): PagedQuery;
  lt(column: string, value: string): PagedQuery;
  in(column: string, values: string[]): PagedQuery;
  order(column: string, options: { ascending: boolean }): PagedQuery;
  range(from: number, to: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
};

async function fetchPaged<T>(
  admin: SupabaseClient,
  table: string,
  select: string,
  apply: (q: PagedQuery) => PagedQuery,
  orderCol = "created_at"
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const base = admin.from(table).select(select) as unknown as PagedQuery;
    const query = apply(base);
    const { data, error } = await query.order(orderCol, { ascending: true }).range(from, from + pageSize - 1);
    if (error) break;
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

function analyticsKpisFromRows(
  rows: { event_type: string; created_at: string; metadata: unknown }[],
  bounds: StatsPeriodBounds
) {
  const views = emptyPeriodKpi();
  const clicksInfluo = emptyPeriodKpi();
  const clicksSocial = emptyPeriodKpi();
  const daily: Record<string, { views: number; clicks: number; social: number }> = {};
  for (const d of bounds.dayKeys30) daily[d] = { views: 0, clicks: 0, social: 0 };

  for (const row of rows) {
    const flags = countInPeriods(row.created_at, bounds);
    const meta =
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : undefined;
    const social = row.event_type === "profile_click" && meta?.source === "social_outbound";
    if (row.event_type === "profile_view") {
      bumpKpi(views, flags);
    } else if (row.event_type === "profile_click") {
      if (social) bumpKpi(clicksSocial, flags);
      else bumpKpi(clicksInfluo, flags);
    }
    const day = athensYmdFromIso(row.created_at);
    if (day && daily[day]) {
      if (row.event_type === "profile_view") daily[day].views += 1;
      if (row.event_type === "profile_click") {
        if (social) daily[day].social += 1;
        else daily[day].clicks += 1;
      }
    }
  }

  return {
    profileViews: views,
    profileClicksInfluo: clicksInfluo,
    profileClicksSocial: clicksSocial,
    analyticsDaily: bounds.dayKeys30.map((date) => ({
      date,
      views: daily[date]?.views ?? 0,
      clicks: daily[date]?.clicks ?? 0,
      social: daily[date]?.social ?? 0,
    })),
  };
}

function emailTypeTops(
  rows: { type: string; sent_at: string; ok: boolean }[],
  bounds: StatsPeriodBounds,
  days: 7 | 30
) {
  const start = days === 7 ? bounds.d7Start : bounds.d30Start;
  const end = bounds.tomorrowStart;
  const t0 = Date.parse(start);
  const t1 = Date.parse(end);
  const map = new Map<string, number>();
  for (const row of rows) {
    const t = Date.parse(row.sent_at);
    if (!Number.isFinite(t) || t < t0 || t >= t1) continue;
    const key = row.type.trim() || "unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
    .slice(0, 10);
}

export async function GET(request: NextRequest) {
  const denied = await rejectUnlessAdmin(request);
  if (denied) return denied;

  const admin = supabaseService();
  const bounds = buildStatsPeriodBounds();
  const kpis: Record<string, PeriodKpi> = {};

  const [
    influencerSignups,
    brandSignups,
    messages,
    conversationsTotal,
    reviewsCount,
    emailsSent,
    emailsOk,
    influencerApprovedTotal,
    influencerPendingTotal,
    brandVerifiedTotal,
    brandPendingTotal,
    collaborationsTotal,
  ] = await Promise.all([
    buildPeriodKpi(admin, "influencers", "created_at", bounds),
    buildPeriodKpi(admin, "brands", "created_at", bounds),
    buildPeriodKpi(admin, "messages", "created_at", bounds),
    headCount(admin, { table: "conversations" }),
    buildPeriodKpi(admin, "influencer_reviews", "created_at", bounds),
    buildPeriodKpi(admin, "email_log", "sent_at", bounds),
    buildPeriodKpi(admin, "email_log", "sent_at", bounds, { eq: { ok: true } }),
    headCount(admin, { table: "influencers", eq: { approved: true } }),
    headCount(admin, { table: "influencers", or: "approved.is.false,approved.is.null" }),
    headCount(admin, { table: "brands", eq: { verified: true } }),
    headCount(admin, { table: "brands", or: "verified.is.false,verified.is.null" }),
    headCount(admin, { table: "proposals", or: "status.eq.accepted,status.eq.completed" }),
  ]);

  kpis.influencer_signups = influencerSignups;
  kpis.brand_signups = brandSignups;
  kpis.messages = messages;
  kpis.influencer_reviews = reviewsCount;
  kpis.emails_sent = emailsSent;
  kpis.emails_ok = emailsOk;
  kpis.conversations = { ...emptyPeriodKpi(), total: conversationsTotal };
  kpis.influencers_approved = { ...emptyPeriodKpi(), total: influencerApprovedTotal };
  kpis.influencers_pending = { ...emptyPeriodKpi(), total: influencerPendingTotal };
  kpis.brands_verified = { ...emptyPeriodKpi(), total: brandVerifiedTotal };
  kpis.brands_pending = { ...emptyPeriodKpi(), total: brandPendingTotal };
  kpis.collaborations = { ...emptyPeriodKpi(), total: collaborationsTotal };

  const [
    campaignsCreated,
    applicationsCreated,
    proposalsCreated,
    influencerApprovedInPeriod,
    campaignStatus,
    applicationStatus,
    proposalStatus,
    campaignStatusAll,
    applicationStatusAll,
    proposalStatusAll,
  ] = await Promise.all([
    buildPeriodKpi(admin, "brand_campaigns", "created_at", bounds),
    buildPeriodKpi(admin, "campaign_applications", "created_at", bounds),
    buildPeriodKpi(admin, "proposals", "created_at", bounds),
    buildPeriodKpi(admin, "influencers", "approved_at", bounds, { eq: { approved: true } }),
    statusTotals(admin, "brand_campaigns", ["draft", "open", "closed"], "created_at", bounds),
    statusTotals(admin, "campaign_applications", ["pending", "accepted", "withdrawn", "rejected", "shortlisted"], "created_at", bounds),
    statusTotals(admin, "proposals", ["pending", "accepted", "completed", "rejected", "cancelled"], "created_at", bounds),
    statusTotals(admin, "brand_campaigns", ["draft", "open", "closed"]),
    statusTotals(admin, "campaign_applications", ["pending", "accepted", "withdrawn", "rejected", "shortlisted"]),
    statusTotals(admin, "proposals", ["pending", "accepted", "completed", "rejected", "cancelled"]),
  ]);

  kpis.campaigns_created = campaignsCreated;
  kpis.applications_created = applicationsCreated;
  kpis.proposals_created = proposalsCreated;
  kpis.influencers_approved_in_period = influencerApprovedInPeriod;

  const [influencerSignupRows, brandSignupRows, topInfluencers, topBrands, analyticsRows, emailRows] =
    await Promise.all([
      fetchPaged<{ created_at: string }>(admin, "influencers", "created_at", (q) =>
        q.gte("created_at", bounds.d30Start).lt("created_at", bounds.tomorrowStart)
      ),
      fetchPaged<{ created_at: string }>(admin, "brands", "created_at", (q) =>
        q.gte("created_at", bounds.d30Start).lt("created_at", bounds.tomorrowStart)
      ),
      admin
        .from("influencers")
        .select("category, location, display_name, contact_email")
        .eq("approved", true),
      admin.from("brands").select("industry, brand_name, contact_email").eq("verified", true),
      fetchPaged<{ event_type: string; created_at: string; metadata: unknown }>(admin, "influencer_analytics", "event_type, created_at, metadata", (q) =>
        q
          .gte("created_at", bounds.d30Start)
          .lt("created_at", bounds.tomorrowStart)
          .in("event_type", ["profile_view", "profile_click"])
      ),
      fetchPaged<{ type: string; sent_at: string; ok: boolean }>(
        admin,
        "email_log",
        "type, sent_at, ok",
        (q) => q.gte("sent_at", bounds.d30Start).lt("sent_at", bounds.tomorrowStart),
        "sent_at"
      ),
    ]);

  const dailySignups = bucketSignupsByDay(
    influencerSignupRows.map((r) => r.created_at),
    brandSignupRows.map((r) => r.created_at),
    bounds.dayKeys30
  );

  const categoryLabels: string[] = [];
  const locationLabels: string[] = [];
  for (const row of topInfluencers.data ?? []) {
    if (
      isProtectedTestAccount({
        display_name: row.display_name as string,
        contact_email: row.contact_email as string,
      })
    ) {
      continue;
    }
    for (const c of splitDelimitedLabels(row.category as string)) categoryLabels.push(c);
    const loc = String(row.location || "").trim();
    if (loc) locationLabels.push(loc);
  }

  const industryLabels: string[] = [];
  for (const row of topBrands.data ?? []) {
    if (
      isProtectedTestAccount({
        brand_name: row.brand_name as string,
        contact_email: row.contact_email as string,
      })
    ) {
      continue;
    }
    for (const c of splitDelimitedLabels(row.industry as string)) industryLabels.push(c);
  }

  const analytics = analyticsKpisFromRows(analyticsRows, bounds);
  kpis.profile_views = analytics.profileViews;
  kpis.profile_clicks_influo = analytics.profileClicksInfluo;
  kpis.profile_clicks_social = analytics.profileClicksSocial;

  const reviewRatings = await fetchPaged<{ rating: number; created_at: string }>(
    admin,
    "influencer_reviews",
    "rating, created_at",
    (q) => q.gte("created_at", bounds.d30Start).lt("created_at", bounds.tomorrowStart)
  );

  const ratingsByPeriod = {
    d7: [] as number[],
    d30: [] as number[],
    today: [] as number[],
  };
  const tToday = Date.parse(bounds.todayStart);
  const tTomorrow = Date.parse(bounds.tomorrowStart);
  const t7 = Date.parse(bounds.d7Start);
  for (const row of reviewRatings) {
    const t = Date.parse(row.created_at);
    const rating = Number(row.rating);
    if (!Number.isFinite(t) || !Number.isFinite(rating)) continue;
    if (t >= t7 && t < tTomorrow) ratingsByPeriod.d7.push(rating);
    if (t >= Date.parse(bounds.d30Start) && t < tTomorrow) ratingsByPeriod.d30.push(rating);
    if (t >= tToday && t < tTomorrow) ratingsByPeriod.today.push(rating);
  }

  const avg = (vals: number[]) => (vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null);

  const funnel = {
    signups: influencerSignups.d30 + brandSignups.d30,
    approved: influencerApprovedTotal,
    applications: applicationsCreated.d30,
    acceptedProposals: (proposalStatus.accepted ?? 0) + (proposalStatus.completed ?? 0),
    completed: proposalStatus.completed ?? 0,
  };

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      kpis,
      dailySignups,
      analyticsDaily: analytics.analyticsDaily,
      funnel,
      tops: {
        categories: aggregateTopLabels(categoryLabels),
        locations: aggregateTopLabels(locationLabels),
        industries: aggregateTopLabels(industryLabels),
      },
      statusTotals: {
        campaigns: { last30d: campaignStatus, all: campaignStatusAll },
        applications: { last30d: applicationStatus, all: applicationStatusAll },
        proposals: { last30d: proposalStatus, all: proposalStatusAll },
      },
      reviews: {
        avgRatingToday: avg(ratingsByPeriod.today),
        avgRating7d: avg(ratingsByPeriod.d7),
        avgRating30d: avg(ratingsByPeriod.d30),
      },
      emails: {
        topTypes7d: emailTypeTops(emailRows, bounds, 7),
        topTypes30d: emailTypeTops(emailRows, bounds, 30),
      },
    },
    { headers: CACHE_HEADERS }
  );
}