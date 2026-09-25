/**
 * Top 10 influencers by composite score:
 *   45% brand activity (unique users × event weights, last N days)
 *   27% channel analysis (influoScore — same as profile "Ανάλυση καναλιού")
 *   13% reach (followers + avg views)
 *   10% reviews (avg_rating × review volume)
 *   5% badges (same badge rules as profiles)
 * Catalog comparison is not used.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const DEFAULT_DAYS = 30;
const TOP_N = 10;
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

async function loadSnapshotsByInfluencer(
  ids: string[]
): Promise<Record<string, Array<{ total: number; at: number }>>> {
  const byId: Record<string, Array<{ total: number; at: number }>> = {};
  if (!ids.length) return byId;

  const { data, error } = await supabaseAdmin
    .from('influencer_follower_snapshots')
    .select('influencer_id, total_followers, snapshot_at')
    .in('influencer_id', ids)
    .order('snapshot_at', { ascending: false })
    .limit(Math.max(90, ids.length * 20));

  if (error) {
    if (!/relation|table|does not exist/i.test(error.message)) {
      console.warn('[top-influencers] snapshots:', error.message);
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

export async function GET() {
  try {
    const days = Math.max(
      1,
      parseInt(process.env.TOP_INFLUENCERS_DAYS || String(DEFAULT_DAYS), 10) || DEFAULT_DAYS
    );
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceIso = since.toISOString();

    let events: AnalyticsRow[] | null = null;
    let eventsErr: { message: string } | null = null;
    const res = await supabaseAdmin
      .from('influencer_analytics')
      .select('id, influencer_id, event_type, brand_email, visitor_id, metadata')
      .gte('created_at', sinceIso)
      .in('event_type', Object.keys(EVENT_WEIGHTS));
    eventsErr = res.error;
    events = res.data as AnalyticsRow[] | null;

    if (eventsErr && /visitor_id|column/i.test(eventsErr.message)) {
      const res2 = await supabaseAdmin
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
      console.error('[top-influencers] Analytics error:', eventsErr);
      return NextResponse.json({ influencers: [] });
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
    if (candidateIds.length < TOP_N) {
      const { data: fill } = await supabaseAdmin
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

    if (candidateIds.length === 0) {
      return NextResponse.json({ influencers: [] });
    }

    const selectFull =
      'id, display_name, avatar_url, videos, video_thumbnails, accounts, category, analytics_verified, verified, auditpr_audit, min_rate, rate_card, total_reviews, avg_rating, past_brands, created_at, audience_top_age, audience_male_percent, audience_female_percent, profile_slug';
    let influencers: TopScoreInfluencer[] | null = null;
    let infErr: { message: string } | null = null;
    {
      const full = await supabaseAdmin
        .from('influencers')
        .select(selectFull)
        .eq('approved', true)
        .in('id', candidateIds);
      infErr = full.error;
      influencers = (full.data as TopScoreInfluencer[] | null) ?? null;
    }

    if (infErr && /column/i.test(infErr.message)) {
      const fallback = await supabaseAdmin
        .from('influencers')
        .select(
          'id, display_name, avatar_url, videos, video_thumbnails, accounts, category, analytics_verified, verified, auditpr_audit'
        )
        .eq('approved', true)
        .in('id', candidateIds);
      influencers = (fallback.data as TopScoreInfluencer[] | null) ?? null;
      infErr = fallback.error;
    }

    if (infErr) {
      console.error('[top-influencers] Influencers fetch error:', infErr);
      return NextResponse.json({ error: infErr.message }, { status: 500 });
    }

    const rows = influencers || [];
    const realIds = rows.map((r) => String(r.id));
    const snapshotsById = await loadSnapshotsByInfluencer(realIds);
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
          blendTopScore(
            activity,
            channelScore,
            reachScore,
            reviewScore,
            badgeScore
          ),
          inf
        );
        return {
          inf,
          id,
          activityRaw: activityRaw[id] ?? 0,
          channelScore,
          reachScore,
          reviewScore,
          badgeScore,
          composite,
        };
      })
      .sort((a, b) => b.composite - a.composite || b.activityRaw - a.activityRaw)
      .slice(0, TOP_N);

    const ordered = ranked.map((r) => ({
      ...r.inf,
      clicks: Math.round(r.activityRaw),
      views: 0,
      score: r.composite,
      channel_score: r.channelScore,
      reach_score: r.reachScore,
      review_score: r.reviewScore,
      badge_score: r.badgeScore,
    }));

    return NextResponse.json({ influencers: ordered });
  } catch (err: unknown) {
    console.error('[top-influencers]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
