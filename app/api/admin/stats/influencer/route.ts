import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rejectUnlessAdmin, supabaseService } from "@/lib/apiAuth";
import {
  athensDayKeysInRange,
  defaultInfluencerStatsPeriod,
  parsePlatformAccount,
  proposalBudgetAmount,
} from "@/lib/adminInfluencerStats";
import { avgOf } from "@/lib/adminPlatformStats";
import { totalFollowersFromAccounts } from "@/lib/parseFollowers";
import {
  buildFollowerGrowthSeries,
  computeFollowerGrowth,
  snapshotAccountsFromProfile,
  type FollowerSnapshotPoint,
  type SnapshotAccountFollowers,
} from "@/lib/followerGrowth";
import {
  boundInfluencerAllTimeRange,
  fetchCapped,
  headCount,
  influencerAnalyticsDailyByHead,
  influencerPeriodAnalyticsTotals,
  runInBatches,
  STATS_REQUEST_TIMEOUT_MS,
} from "@/lib/adminStatsRouteHelpers";
import { createStatsSwrCache } from "@/lib/adminStatsSingleFlight";
import { isTimeoutError, TimeoutError, withTimeout } from "@/lib/withTimeout";

const CACHE_HEADERS = { "Cache-Control": "private, no-store" };

const APPLICATION_STATUSES = ["pending", "accepted", "withdrawn", "rejected", "shortlisted"] as const;
const PROPOSAL_STATUSES = ["pending", "accepted", "completed", "rejected", "cancelled"] as const;

const influencerCacheByKey = new Map<string, ReturnType<typeof createStatsSwrCache<unknown>>>();

function influencerCacheForKey(key: string) {
  let cache = influencerCacheByKey.get(key);
  if (!cache) {
    cache = createStatsSwrCache<unknown>();
    influencerCacheByKey.set(key, cache);
  }
  return cache;
}

function cacheKey(id: string, start: string | null, end: string | null, allTime: boolean): string {
  return JSON.stringify({ id, start, end, allTime });
}

function parseStoredSnapshotAccounts(raw: unknown): SnapshotAccountFollowers[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const out: SnapshotAccountFollowers[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const platform = String((row as { platform?: unknown }).platform || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    const username = String((row as { username?: unknown }).username || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
    const followers = Number((row as { followers?: unknown }).followers);
    if (!platform || !username || !Number.isFinite(followers) || !(followers > 0)) continue;
    out.push({ platform, username, followers: Math.round(followers) });
  }
  return out.length ? out : null;
}

async function loadFollowerGrowth(admin: SupabaseClient, influencerId: string) {
  const full = await admin
    .from("influencers")
    .select("id, accounts, last_social_refresh_at")
    .eq("id", influencerId)
    .maybeSingle();

  let influencer:
    | { id: string; accounts?: unknown; last_social_refresh_at?: string | null }
    | null
    | undefined = full.data;
  if (full.error && /last_social_refresh_at|column/i.test(full.error.message)) {
    const bare = await admin.from("influencers").select("id, accounts").eq("id", influencerId).maybeSingle();
    influencer = bare.data;
  }
  if (!influencer) {
    return {
      currentTotal: 0,
      growth: null as number | null,
      growthPct: null as number | null,
      series: [] as ReturnType<typeof buildFollowerGrowthSeries>,
    };
  }

  const accounts =
    (influencer.accounts as Array<{
      platform?: string | null;
      username?: string | null;
      followers?: string | number | null;
    }>) ?? [];
  const currentAccounts = snapshotAccountsFromProfile(accounts);
  const currentTotal = totalFollowersFromAccounts(accounts);

  type SnapshotRow = {
    total_followers?: number | string | null;
    snapshot_at?: string | null;
    accounts?: unknown;
  };
  let snapshots: SnapshotRow[] = [];
  let snapErr: { message?: string } | null = null;
  {
    const snapFull = await admin
      .from("influencer_follower_snapshots")
      .select("total_followers, snapshot_at, accounts")
      .eq("influencer_id", influencerId)
      .order("snapshot_at", { ascending: false })
      .limit(90);
    if (snapFull.error && /accounts|column/i.test(snapFull.error.message || "")) {
      const bare = await admin
        .from("influencer_follower_snapshots")
        .select("total_followers, snapshot_at")
        .eq("influencer_id", influencerId)
        .order("snapshot_at", { ascending: false })
        .limit(90);
      snapshots = (bare.data || []) as SnapshotRow[];
      snapErr = bare.error;
    } else {
      snapshots = (snapFull.data || []) as SnapshotRow[];
      snapErr = snapFull.error;
    }
  }

  if (snapErr && /relation|table|does not exist/i.test(snapErr.message || "")) {
    return { currentTotal, growth: null, growthPct: null, series: [] };
  }

  const rows: FollowerSnapshotPoint[] = [];
  for (const s of snapshots) {
    const raw = Number(s.total_followers);
    const at = s.snapshot_at ? new Date(s.snapshot_at).getTime() : NaN;
    if (!(raw > 0) || !Number.isFinite(at)) continue;
    rows.push({ total: raw, at, accounts: parseStoredSnapshotAccounts(s.accounts) });
  }

  const growthResult = computeFollowerGrowth(rows, currentAccounts, currentTotal);
  const series = buildFollowerGrowthSeries(growthResult?.seriesSource || rows, growthResult?.currentTotal ?? currentTotal);

  return {
    currentTotal: growthResult?.currentTotal ?? currentTotal,
    growth: growthResult?.growth ?? null,
    growthPct: growthResult?.growthPct ?? null,
    series,
  };
}

async function countMessagesInPeriod(
  admin: SupabaseClient,
  conversationIds: string[],
  start: string | null,
  end: string | null
): Promise<number> {
  if (!conversationIds.length) return 0;
  const chunkSize = 80;
  let total = 0;
  for (let i = 0; i < conversationIds.length; i += chunkSize) {
    const chunk = conversationIds.slice(i, i + chunkSize);
    let q = admin.from("messages").select("id", { count: "exact", head: true }).in("conversation_id", chunk);
    if (start) q = q.gte("created_at", start);
    if (end) q = q.lt("created_at", end);
    const { count, error } = await q;
    if (error) continue;
    total += count ?? 0;
  }
  return total;
}

async function statusTotalsForInfluencer(
  admin: SupabaseClient,
  table: string,
  influencerId: string,
  statuses: readonly string[],
  start: string | null,
  end: string | null
): Promise<{ total: number; byStatus: Record<string, number> }> {
  const fns = statuses.map((status) => async () => {
    const q = {
      table,
      eq: { influencer_id: influencerId, status },
      dateCol: undefined as string | undefined,
      gte: undefined as string | undefined,
      lt: undefined as string | undefined,
    };
    if (start || end) {
      q.dateCol = "created_at";
      if (start) q.gte = start;
      if (end) q.lt = end;
    }
    return { status, n: await headCount(admin, q) };
  });
  const rows = await runInBatches(fns);
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const { status, n } of rows) {
    byStatus[status] = n;
    total += n;
  }
  return { total, byStatus };
}

async function buildInfluencerPayload(
  admin: SupabaseClient,
  id: string,
  start: string | null,
  end: string | null,
  allTime: boolean
) {
  const dayKeys = start && end ? athensDayKeysInRange(start, end) : null;

  const [totals, growth, convResult, proposalsByStatus, applicationsByStatus, reviewAvg, influencerRow] =
    await Promise.all([
      influencerPeriodAnalyticsTotals(admin, id, start, end),
      loadFollowerGrowth(admin, id),
      admin.from("conversations").select("id").eq("influencer_id", id).limit(500),
      statusTotalsForInfluencer(admin, "proposals", id, PROPOSAL_STATUSES, start, end),
      statusTotalsForInfluencer(admin, "campaign_applications", id, APPLICATION_STATUSES, start, end),
      (async () => {
        const base = { table: "influencer_reviews", eq: { influencer_id: id } } as const;
        const window = {
          ...base,
          dateCol: "created_at" as const,
          ...(start ? { gte: start } : {}),
          ...(end ? { lt: end } : {}),
        };
        const count = await headCount(admin, start || end ? window : base);
        const ratings = await fetchCapped<{ rating: number }>(
          admin,
          "influencer_reviews",
          "rating",
          (q) => {
            let cur = q.eq("influencer_id", id);
            if (start) cur = cur.gte("created_at", start);
            if (end) cur = cur.lt("created_at", end);
            return cur;
          },
          500
        );
        const nums = ratings.map((r) => Number(r.rating)).filter((n) => Number.isFinite(n));
        return { count, avg: avgOf(nums) };
      })(),
      admin.from("influencers").select("accounts").eq("id", id).maybeSingle(),
    ]);

  const daily = await influencerAnalyticsDailyByHead(admin, id, dayKeys);
  const analytics = {
    profileViews: totals.profileViews,
    profileClicksInfluo: totals.profileClicksInfluo,
    socialOutboundClicks: totals.socialOutboundClicks,
    socialOutboundByPlatform: {} as Record<string, number>,
    daily,
  };

  const recentResult = await (async () => {
    let q = admin
      .from("influencer_analytics")
      .select("id, event_type, metadata, created_at")
      .eq("influencer_id", id)
      .order("created_at", { ascending: false })
      .limit(40);
    if (start) q = q.gte("created_at", start);
    if (end) q = q.lt("created_at", end);
    return q;
  })();

  const earningsRows = await fetchCapped<{
    status: string;
    budget: string | null;
    counter_proposal_budget: string | null;
  }>(
    admin,
    "proposals",
    "status, budget, counter_proposal_budget",
    (q) => {
      let cur = q.eq("influencer_id", id).in("status", ["accepted", "completed"]);
      if (start) cur = cur.gte("created_at", start);
      if (end) cur = cur.lt("created_at", end);
      return cur;
    },
    500
  );

  const recentEvents = recentResult.error ? [] : recentResult.data ?? [];

  const proposalsTotal = proposalsByStatus.total;
  const collaborations = (proposalsByStatus.byStatus.accepted ?? 0) + (proposalsByStatus.byStatus.completed ?? 0);
  const earnings = earningsRows.reduce((sum, p) => sum + proposalBudgetAmount(p), 0);

  const conversationIds = (convResult.data ?? []).map((c) => c.id as string);
  const messagesCount = await countMessagesInPeriod(admin, conversationIds, start, end);

  const accountsRaw = influencerRow.data?.accounts;
  const accounts = Array.isArray(accountsRaw)
    ? accountsRaw.map(parsePlatformAccount).filter((a): a is NonNullable<typeof a> => a != null)
    : [];

  return {
    period: { start, end, allTimeCapped: allTime || undefined },
    analytics,
    proposals: { total: proposalsTotal, byStatus: proposalsByStatus.byStatus, collaborations, earnings },
    applications: { total: applicationsByStatus.total, byStatus: applicationsByStatus.byStatus },
    messages: { total: messagesCount },
    reviews: { count: reviewAvg.count, avgRating: reviewAvg.avg },
    growth,
    platformAccounts: accounts,
    recentEvents,
  };
}

export async function GET(request: NextRequest) {
  const denied = await rejectUnlessAdmin(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const id = (searchParams.get("id") || "").trim();
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const allTime = searchParams.get("range") === "all";
  let start = (searchParams.get("start") || "").trim() || null;
  let end = (searchParams.get("end") || "").trim() || null;
  if (allTime) {
    const capped = boundInfluencerAllTimeRange();
    start = capped.start;
    end = capped.end;
  } else if (!start && !end) {
    const def = defaultInfluencerStatsPeriod();
    start = def.start;
    end = def.end;
  } else if (!end) {
    end = new Date().toISOString();
  }

  const key = cacheKey(id, start, end, allTime);
  const cache = influencerCacheForKey(key);
  const admin = supabaseService();

  try {
    const payload = await cache.serve(() =>
      withTimeout(buildInfluencerPayload(admin, id, start, end, allTime), STATS_REQUEST_TIMEOUT_MS)
    );
    return NextResponse.json(payload, { headers: CACHE_HEADERS });
  } catch (err) {
    const stale = cache.peek();
    if (stale) {
      return NextResponse.json(stale, { headers: CACHE_HEADERS });
    }
    if (isTimeoutError(err) || err instanceof TimeoutError) {
      return NextResponse.json({ error: "timeout" }, { status: 504, headers: CACHE_HEADERS });
    }
    throw err;
  }
}