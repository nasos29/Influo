import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rejectUnlessAdmin, supabaseService } from "@/lib/apiAuth";
import { isProtectedTestAccount } from "@/lib/protectedAccount";
import {
  aggregateTopLabels,
  bucketSignupsByDay,
  buildStatsPeriodBounds,
  type PeriodKpi,
  splitDelimitedLabels,
  type StatsPeriodBounds,
} from "@/lib/adminPlatformStats";
import {
  buildPeriodKpi,
  EMAIL_LOG_ROW_CAP,
  fetchCapped,
  headCount,
  platformAnalyticsDailyByHead,
  platformAnalyticsKpis,
  REVIEW_RATINGS_ROW_CAP,
  runInBatches,
  STATS_REQUEST_TIMEOUT_MS,
  statusTotalsBatched,
} from "@/lib/adminStatsRouteHelpers";
import { createStatsSwrCache } from "@/lib/adminStatsSingleFlight";
import { isTimeoutError, TimeoutError, withTimeout } from "@/lib/withTimeout";

const CACHE_HEADERS = { "Cache-Control": "private, no-store" };

type OverviewPayload = {
  generatedAt: string;
  kpis: Record<string, PeriodKpi>;
  dailySignups: { date: string; creators: number; brands: number }[];
  analyticsDaily: { date: string; views: number; clicks: number; social: number }[];
  funnel: {
    signups: number;
    approved: number;
    applications: number;
    acceptedProposals: number;
    completed: number;
  };
  tops: {
    categories: { label: string; count: number }[];
    locations: { label: string; count: number }[];
    industries: { label: string; count: number }[];
  };
  statusTotals: {
    campaigns: { last30d: Record<string, number>; all: Record<string, number> };
    applications: { last30d: Record<string, number>; all: Record<string, number> };
    proposals: { last30d: Record<string, number>; all: Record<string, number> };
  };
  reviews: {
    avgRatingToday: number | null;
    avgRating7d: number | null;
    avgRating30d: number | null;
  };
  emails: {
    topTypes7d: { type: string; count: number }[];
    topTypes30d: { type: string; count: number }[];
  };
};

const overviewCache = createStatsSwrCache<OverviewPayload>();

function emailTypeTops(
  rows: { type: string; sent_at: string }[],
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

async function buildOverviewPayload(admin: SupabaseClient): Promise<OverviewPayload> {
  const bounds = buildStatsPeriodBounds();
  const kpis: Record<string, PeriodKpi> = {};

  const periodJobs = [
    () => buildPeriodKpi(admin, "influencers", "created_at", bounds),
    () => buildPeriodKpi(admin, "brands", "created_at", bounds),
    () => buildPeriodKpi(admin, "messages", "created_at", bounds),
    () => headCount(admin, { table: "conversations" }),
    () => buildPeriodKpi(admin, "influencer_reviews", "created_at", bounds),
    () => buildPeriodKpi(admin, "email_log", "sent_at", bounds),
    () => buildPeriodKpi(admin, "email_log", "sent_at", bounds, { eq: { ok: true } }),
    () => headCount(admin, { table: "influencers", eq: { approved: true } }),
    () => headCount(admin, { table: "influencers", or: "approved.is.false,approved.is.null" }),
    () => headCount(admin, { table: "brands", eq: { verified: true } }),
    () => headCount(admin, { table: "brands", or: "verified.is.false,verified.is.null" }),
    () => headCount(admin, { table: "proposals", or: "status.eq.accepted,status.eq.completed" }),
    () => buildPeriodKpi(admin, "brand_campaigns", "created_at", bounds),
    () => buildPeriodKpi(admin, "campaign_applications", "created_at", bounds),
    () => buildPeriodKpi(admin, "proposals", "created_at", bounds),
    () => buildPeriodKpi(admin, "influencers", "approved_at", bounds, { eq: { approved: true } }),
  ];

  const periodResults = await runInBatches<PeriodKpi | number>(
    periodJobs as (() => Promise<PeriodKpi | number>)[]
  );
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
    campaignsCreated,
    applicationsCreated,
    proposalsCreated,
    influencerApprovedInPeriod,
  ] = periodResults;

  kpis.influencer_signups = influencerSignups as PeriodKpi;
  kpis.brand_signups = brandSignups as PeriodKpi;
  kpis.messages = messages as PeriodKpi;
  kpis.influencer_reviews = reviewsCount as PeriodKpi;
  kpis.emails_sent = emailsSent as PeriodKpi;
  kpis.emails_ok = emailsOk as PeriodKpi;
  kpis.conversations = { today: 0, d7: 0, prev7: 0, d30: 0, prev30: 0, total: conversationsTotal as number };
  kpis.influencers_approved = { today: 0, d7: 0, prev7: 0, d30: 0, prev30: 0, total: influencerApprovedTotal as number };
  kpis.influencers_pending = { today: 0, d7: 0, prev7: 0, d30: 0, prev30: 0, total: influencerPendingTotal as number };
  kpis.brands_verified = { today: 0, d7: 0, prev7: 0, d30: 0, prev30: 0, total: brandVerifiedTotal as number };
  kpis.brands_pending = { today: 0, d7: 0, prev7: 0, d30: 0, prev30: 0, total: brandPendingTotal as number };
  kpis.collaborations = { today: 0, d7: 0, prev7: 0, d30: 0, prev30: 0, total: collaborationsTotal as number };
  kpis.campaigns_created = campaignsCreated as PeriodKpi;
  kpis.applications_created = applicationsCreated as PeriodKpi;
  kpis.proposals_created = proposalsCreated as PeriodKpi;
  kpis.influencers_approved_in_period = influencerApprovedInPeriod as PeriodKpi;

  const statusBatch = await runInBatches<Record<string, number>>(
    [
      () => statusTotalsBatched(admin, "brand_campaigns", ["draft", "open", "closed"], "created_at", bounds),
      () =>
        statusTotalsBatched(
          admin,
          "campaign_applications",
          ["pending", "accepted", "withdrawn", "rejected", "shortlisted"],
          "created_at",
          bounds
        ),
      () =>
        statusTotalsBatched(
          admin,
          "proposals",
          ["pending", "accepted", "completed", "rejected", "cancelled"],
          "created_at",
          bounds
        ),
      () => statusTotalsBatched(admin, "brand_campaigns", ["draft", "open", "closed"]),
      () =>
        statusTotalsBatched(admin, "campaign_applications", [
          "pending",
          "accepted",
          "withdrawn",
          "rejected",
          "shortlisted",
        ]),
      () => statusTotalsBatched(admin, "proposals", ["pending", "accepted", "completed", "rejected", "cancelled"]),
    ],
    4
  );
  const [campaignStatus, applicationStatus, proposalStatus, campaignStatusAll, applicationStatusAll, proposalStatusAll] =
    statusBatch;
  const platformAnalytics = await platformAnalyticsKpis(admin, bounds);

  kpis.profile_views = platformAnalytics.profileViews;
  kpis.profile_clicks_influo = platformAnalytics.profileClicksInfluo;
  kpis.profile_clicks_social = platformAnalytics.profileClicksSocial;

  const [
    influencerSignupRows,
    brandSignupRows,
    topInfluencers,
    topBrands,
    emailRows,
    reviewRatings,
    analyticsDaily,
  ] = await Promise.all([
    fetchCapped<{ created_at: string }>(
      admin,
      "influencers",
      "created_at",
      (q) => q.gte("created_at", bounds.d30Start).lt("created_at", bounds.tomorrowStart),
      500
    ),
    fetchCapped<{ created_at: string }>(
      admin,
      "brands",
      "created_at",
      (q) => q.gte("created_at", bounds.d30Start).lt("created_at", bounds.tomorrowStart),
      500
    ),
    admin.from("influencers").select("category, location, display_name, contact_email").eq("approved", true),
    admin.from("brands").select("industry, brand_name, contact_email").eq("verified", true),
    fetchCapped<{ type: string; sent_at: string }>(
      admin,
      "email_log",
      "type, sent_at",
      (q) => q.gte("sent_at", bounds.d30Start).lt("sent_at", bounds.tomorrowStart),
      EMAIL_LOG_ROW_CAP,
      "sent_at"
    ),
    fetchCapped<{ rating: number; created_at: string }>(
      admin,
      "influencer_reviews",
      "rating, created_at",
      (q) => q.gte("created_at", bounds.d30Start).lt("created_at", bounds.tomorrowStart),
      REVIEW_RATINGS_ROW_CAP
    ),
    platformAnalyticsDailyByHead(admin, bounds),
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
    signups: (influencerSignups as PeriodKpi).d30 + (brandSignups as PeriodKpi).d30,
    approved: influencerApprovedTotal as number,
    applications: (applicationsCreated as PeriodKpi).d30,
    acceptedProposals: (proposalStatus.accepted ?? 0) + (proposalStatus.completed ?? 0),
    completed: proposalStatus.completed ?? 0,
  };

  return {
    generatedAt: new Date().toISOString(),
    kpis,
    dailySignups,
    analyticsDaily,
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
  };
}

export async function GET(request: NextRequest) {
  const denied = await rejectUnlessAdmin(request);
  if (denied) return denied;

  const admin = supabaseService();

  try {
    const payload = await overviewCache.serve(() =>
      withTimeout(buildOverviewPayload(admin), STATS_REQUEST_TIMEOUT_MS)
    );
    return NextResponse.json(payload, { headers: CACHE_HEADERS });
  } catch (err) {
    const stale = overviewCache.peek();
    if (stale) {
      return NextResponse.json(stale, { headers: CACHE_HEADERS });
    }
    if (isTimeoutError(err) || err instanceof TimeoutError) {
      return NextResponse.json({ error: "timeout" }, { status: 504, headers: CACHE_HEADERS });
    }
    throw err;
  }
}