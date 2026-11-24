import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rejectUnlessAdmin, supabaseService } from "@/lib/apiAuth";
import {
  aggregateProfileAnalytics,
  athensDayKeysInRange,
  defaultInfluencerStatsPeriod,
  filterByCreatedAt,
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

const CACHE_HEADERS = { "Cache-Control": "private, no-store" };

const APPLICATION_STATUSES = ["pending", "accepted", "withdrawn", "rejected", "shortlisted"] as const;
const PROPOSAL_STATUSES = ["pending", "accepted", "completed", "rejected", "cancelled"] as const;

type PagedQuery = {
  eq(column: string, value: string): PagedQuery;
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

function statusCounts<T extends { status: string }>(rows: T[], statuses: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of statuses) out[s] = 0;
  for (const row of rows) {
    const key = row.status;
    if (key in out) out[key] += 1;
    else out[key] = (out[key] ?? 0) + 1;
  }
  return out;
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
    start = null;
    end = null;
  } else if (!start && !end) {
    const def = defaultInfluencerStatsPeriod();
    start = def.start;
    end = def.end;
  } else if (!end) {
    end = new Date().toISOString();
  }

  const admin = supabaseService();
  const dayKeys = start && end ? athensDayKeysInRange(start, end) : null;

  const analyticsApply = (q: PagedQuery) => {
    let query = q.eq("influencer_id", id);
    if (start) query = query.gte("created_at", start);
    if (end) query = query.lt("created_at", end);
    return query;
  };

  const [analyticsRows, recentResult, growth, convRows, proposalRows, applicationRows, reviewRows, influencerRow] =
    await Promise.all([
      fetchPaged<{ event_type: string; created_at: string; metadata: unknown }>(
        admin,
        "influencer_analytics",
        "created_at,event_type,metadata",
        analyticsApply
      ),
      (async () => {
        let q = admin
          .from("influencer_analytics")
          .select("id, event_type, metadata, created_at")
          .eq("influencer_id", id)
          .order("created_at", { ascending: false })
          .limit(40);
        if (start) q = q.gte("created_at", start);
        if (end) q = q.lt("created_at", end);
        return q;
      })(),
      loadFollowerGrowth(admin, id),
      fetchPaged<{ id: string }>(admin, "conversations", "id", (q) => q.eq("influencer_id", id)),
      fetchPaged<{ status: string; created_at: string; budget: string | null; counter_proposal_budget: string | null }>(
        admin,
        "proposals",
        "status, created_at, budget, counter_proposal_budget",
        (q) => q.eq("influencer_id", id)
      ),
      fetchPaged<{ status: string; created_at: string }>(admin, "campaign_applications", "status, created_at", (q) =>
        q.eq("influencer_id", id)
      ),
      fetchPaged<{ rating: number; created_at: string }>(admin, "influencer_reviews", "rating, created_at", (q) =>
        q.eq("influencer_id", id)
      ),
      admin.from("influencers").select("accounts").eq("id", id).maybeSingle(),
    ]);

  const recentEvents = recentResult.error ? [] : recentResult.data ?? [];

  const analytics = aggregateProfileAnalytics(analyticsRows, dayKeys);

  const proposalsInPeriod = filterByCreatedAt(proposalRows, start, end);
  const applicationsInPeriod = filterByCreatedAt(applicationRows, start, end);
  const reviewsInPeriod = filterByCreatedAt(reviewRows, start, end);

  const proposalsByStatus = statusCounts(proposalsInPeriod, PROPOSAL_STATUSES);
  const applicationsByStatus = statusCounts(applicationsInPeriod, APPLICATION_STATUSES);
  const proposalsTotal = proposalsInPeriod.length;
  const collaborations = (proposalsByStatus.accepted ?? 0) + (proposalsByStatus.completed ?? 0);

  const earnings = proposalsInPeriod
    .filter((p) => p.status === "accepted" || p.status === "completed")
    .reduce((sum, p) => sum + proposalBudgetAmount(p), 0);

  const ratings = reviewsInPeriod.map((r) => Number(r.rating)).filter((n) => Number.isFinite(n));
  const reviewsCount = reviewsInPeriod.length;
  const reviewsAvg = avgOf(ratings);

  const conversationIds = convRows.map((c) => c.id);
  const messagesCount = await countMessagesInPeriod(admin, conversationIds, start, end);

  const accountsRaw = influencerRow.data?.accounts;
  const accounts = Array.isArray(accountsRaw)
    ? accountsRaw.map(parsePlatformAccount).filter((a): a is NonNullable<typeof a> => a != null)
    : [];

  return NextResponse.json(
    {
      period: { start, end },
      analytics,
      proposals: { total: proposalsTotal, byStatus: proposalsByStatus, collaborations, earnings },
      applications: { total: applicationsInPeriod.length, byStatus: applicationsByStatus },
      messages: { total: messagesCount },
      reviews: { count: reviewsCount, avgRating: reviewsAvg },
      growth,
      platformAccounts: accounts,
      recentEvents,
    },
    { headers: CACHE_HEADERS }
  );
}