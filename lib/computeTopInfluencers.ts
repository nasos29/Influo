/**
 * Shared Top 10 ranking used by /api/top-influencers and Top 10 congrats cron.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  alignFollowerSnapshotToCurrent,
  totalFollowersFromAccounts,
} from '@/lib/parseFollowers';
import {
  applyTopTrustPenalty,
  blendTopScore,
  computeBadgeScore,
  computeChannelScore100,
  computeReachScore,
  computeReviewScore,
  growthPctFromSnapshots,
  normalizeScores,
  type TopScoreInfluencer,
} from '@/lib/topInfluencerScore';

const DEFAULT_DAYS = 30;
export const TOP_INFLUENCERS_N = 10;
const ACTIVITY_POOL = 40;

const EVENT_WEIGHTS: Record<string, number> = {
  profile_view: 1,
  profile_click: 3,
  message_sent: 4,
  conversation_started: 5,
  proposal_sent: 10,
};

type AnalyticsRow = {
  id?: string;
  influencer_id?: string | null;
  event_type?: string | null;
  brand_email?: string | null;
  visitor_id?: string | null;
  metadata?: unknown;
};

export type TopInfluencerRow = {
  id: string;
  display_name: string;
  display_name_en: null;
  avatar_url: string | null;
  accounts: TopScoreInfluencer['accounts'];
  category: string | null;
  profile_slug: string | null;
  clicks: number;
  views: number;
};

function isSocialOutboundProfileClick(e: {
  event_type?: string | null;
  metadata?: unknown;
}): boolean {
  if (e.event_type !== 'profile_click') return false;
  const m = e.metadata as Record<string, unknown> | null | undefined;
  return !!m && typeof m === 'object' && m.source === 'social_outbound';
}

function idKey(id: string): string {
  return String(id).trim().toLowerCase();
}

function getAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function loadSnapshotsByInfluencer(
  sb: SupabaseClient,
  ids: string[]
): Promise<Record<string, Array<{ total: number; at: number }>>> {
  const byId: Record<string, Array<{ total: number; at: number }>> = {};
  if (!ids.length) return byId;

  const { data, error } = await sb
    .from('influencer_follower_snapshots')
    .select('influencer_id, total_followers, snapshot_at')
    .in('influencer_id', ids)
    .order('snapshot_at', { ascending: false })
    .limit(Math.max(90, ids.length * 20));

  if (error) {
    if (!/relation|table|does not exist/i.test(error.message)) {
      console.warn('[computeTopInfluencers] snapshots:', error.message);
    }
    return byId;
  }

  for (const row of data || []) {
    const id = idKey(String(row.influencer_id));
    const at = new Date(row.snapshot_at as string).getTime();
    const raw = Number(row.total_followers);
    if (!Number.isFinite(at) || !(raw > 0)) continue;
    if (!byId[id]) byId[id] = [];
    byId[id].push({ total: raw, at });
  }
  return byId;
}

/** Rank approved influencers and return the top N for homepage / notifications. */
export async function computeTopInfluencers(
  options?: { limit?: number; days?: number; supabase?: SupabaseClient }
): Promise<TopInfluencerRow[]> {
  const sb = options?.supabase ?? getAdmin();
  const topN = options?.limit ?? TOP_INFLUENCERS_N;
  const days = Math.max(
    1,
    options?.days ??
      (parseInt(process.env.TOP_INFLUENCERS_DAYS || String(DEFAULT_DAYS), 10) ||
        DEFAULT_DAYS)
  );
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  let events: AnalyticsRow[] | null = null;
  let eventsErr: { message: string } | null = null;
  const res = await sb
    .from('influencer_analytics')
    .select('id, influencer_id, event_type, brand_email, visitor_id, metadata')
    .gte('created_at', sinceIso)
    .in('event_type', Object.keys(EVENT_WEIGHTS));
  eventsErr = res.error;
  events = res.data as AnalyticsRow[] | null;

  if (eventsErr && /visitor_id|column/i.test(eventsErr.message)) {
    const res2 = await sb
      .from('influencer_analytics')
      .select('id, influencer_id, event_type, brand_email, metadata')
      .gte('created_at', sinceIso)
      .in('event_type', Object.keys(EVENT_WEIGHTS));
    eventsErr = res2.error;
    events = (res2.data ?? []).map(
      (r: {
        id?: string;
        influencer_id?: string | null;
        event_type?: string | null;
        brand_email?: string | null;
        metadata?: unknown;
      }) => ({ ...r, visitor_id: null })
    );
  }

  if (eventsErr) {
    throw new Error(eventsErr.message);
  }

  const activityRaw: Record<string, number> = {};
  const uniq: Record<string, Set<string>> = {};
  for (const e of events ?? []) {
    if (isSocialOutboundProfileClick(e)) continue;
    const id = e.influencer_id != null ? idKey(String(e.influencer_id)) : null;
    if (!id) continue;
    const userKey =
      (e.brand_email || '').trim() ||
      (e.visitor_id || '').trim() ||
      (e.id != null ? String(e.id) : '');
    const key = `${id}\t${e.event_type || ''}`;
    if (!uniq[key]) uniq[key] = new Set();
    if (userKey && uniq[key].has(userKey)) continue;
    uniq[key].add(userKey);
    const w = EVENT_WEIGHTS[e.event_type || ''] ?? 0;
    activityRaw[id] = (activityRaw[id] ?? 0) + w;
  }

  const activityPoolIds = Object.entries(activityRaw)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, ACTIVITY_POOL)
    .map(([id]) => id);

  let candidateIds = activityPoolIds;
  if (candidateIds.length < topN) {
    const { data: fill } = await sb
      .from('influencers')
      .select('id')
      .eq('approved', true)
      .not('accounts', 'is', null)
      .order('approved_at', { ascending: false })
      .limit(ACTIVITY_POOL);
    const seen = new Set(candidateIds);
    for (const row of fill || []) {
      const id = idKey(String(row.id));
      if (seen.has(id)) continue;
      seen.add(id);
      candidateIds.push(id);
      if (candidateIds.length >= ACTIVITY_POOL) break;
    }
  }

  if (candidateIds.length === 0) return [];

  const selectFull =
    'id, display_name, avatar_url, videos, video_thumbnails, accounts, category, analytics_verified, verified, auditpr_audit, min_rate, rate_card, total_reviews, avg_rating, created_at, audience_top_age, audience_male_percent, audience_female_percent, profile_slug';
  let influencers: TopScoreInfluencer[] | null = null;
  let infErr: { message: string } | null = null;
  {
    const full = await sb
      .from('influencers')
      .select(selectFull)
      .eq('approved', true)
      .in('id', candidateIds);
    infErr = full.error;
    influencers = (full.data as TopScoreInfluencer[] | null) ?? null;
  }

  if (infErr && /column/i.test(infErr.message)) {
    const fallback = await sb
      .from('influencers')
      .select(
        'id, display_name, avatar_url, videos, video_thumbnails, accounts, category, analytics_verified, verified, auditpr_audit'
      )
      .eq('approved', true)
      .in('id', candidateIds);
    influencers = (fallback.data as TopScoreInfluencer[] | null) ?? null;
    infErr = fallback.error;
  }

  if (infErr) throw new Error(infErr.message);

  const rows = influencers || [];
  const realIds = rows.map((r) => String(r.id));
  const snapshotsById = await loadSnapshotsByInfluencer(sb, realIds);
  const activityNorm = normalizeScores(activityRaw);
  const now = Date.now();

  const ranked = rows
    .map((inf) => {
      const id = idKey(String(inf.id));
      const currentTotal = totalFollowersFromAccounts(inf.accounts || []);
      const rawSnaps = snapshotsById[id] || [];
      const aligned = rawSnaps
        .map((s) => {
          const total = alignFollowerSnapshotToCurrent(s.total, currentTotal);
          return total != null ? { total, at: s.at } : null;
        })
        .filter((s): s is { total: number; at: number } => s != null);
      const growthPct = growthPctFromSnapshots(currentTotal, aligned, now);
      const activity = activityNorm[id] ?? 0;
      const channelScore = computeChannelScore100(inf, growthPct);
      const reachScore = computeReachScore(inf);
      const reviewScore = computeReviewScore(inf);
      const badgeScore = computeBadgeScore(inf);
      const composite = applyTopTrustPenalty(
        blendTopScore(activity, channelScore, reachScore, reviewScore, badgeScore),
        inf
      );
      return {
        inf,
        id,
        activityRaw: activityRaw[id] ?? 0,
        composite,
      };
    })
    .sort((a, b) => b.composite - a.composite || b.activityRaw - a.activityRaw)
    .slice(0, topN);

  return ranked.map((r) => {
    const inf = r.inf as TopScoreInfluencer & {
      display_name?: string | null;
      avatar_url?: string | null;
      category?: string | null;
      profile_slug?: string | null;
    };
    return {
      id: String(inf.id),
      display_name: inf.display_name ?? '',
      display_name_en: null,
      avatar_url: inf.avatar_url ?? null,
      accounts: inf.accounts ?? null,
      category: (inf.category as string | null) ?? null,
      profile_slug: inf.profile_slug ?? null,
      clicks: Math.round(r.activityRaw),
      views: 0,
    };
  });
}
