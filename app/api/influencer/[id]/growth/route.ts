/**
 * GET /api/influencer/[id]/growth
 * Returns 15-day follower growth for the profile card.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { alignFollowerSnapshotToCurrent, totalFollowersFromAccounts } from '@/lib/parseFollowers';
import { buildFollowerGrowthSeries, FOLLOWER_GROWTH_WINDOW_DAYS } from '@/lib/followerGrowth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type InfluencerGrowthRow = {
  id: string;
  accounts?: unknown;
  last_social_refresh_at?: string | null;
};

async function loadInfluencerForGrowth(
  id: string
): Promise<{ ok: true; data: InfluencerGrowthRow } | { ok: false; status: number }> {
  const full = await supabaseAdmin
    .from('influencers')
    .select('id, accounts, last_social_refresh_at')
    .eq('id', id)
    .maybeSingle();

  if (full.error && /last_social_refresh_at|column/i.test(full.error.message)) {
    const bare = await supabaseAdmin
      .from('influencers')
      .select('id, accounts')
      .eq('id', id)
      .maybeSingle();
    if (bare.error || !bare.data) return { ok: false, status: 404 };
    return { ok: true, data: bare.data };
  }

  if (full.error || !full.data) return { ok: false, status: 404 };
  return { ok: true, data: full.data };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const loaded = await loadInfluencerForGrowth(id);
    if (!loaded.ok) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: loaded.status });
    }
    const influencer = loaded.data;

    const accounts = (influencer.accounts as Array<{ followers?: string | number | null }>) ?? [];
    const currentTotal = totalFollowersFromAccounts(accounts);
    const lastSocialRefreshAt =
      typeof influencer.last_social_refresh_at === 'string' ? influencer.last_social_refresh_at : null;

    const { data: snapshots, error: snapErr } = await supabaseAdmin
      .from('influencer_follower_snapshots')
      .select('total_followers, snapshot_at')
      .eq('influencer_id', id)
      .order('snapshot_at', { ascending: false })
      .limit(90);

    if (snapErr && /relation|table|does not exist/i.test(snapErr.message)) {
      return NextResponse.json({
        currentTotal,
        oldTotal: null,
        growth: null,
        growthPct: null,
        series: [],
        statsUpdatedAt: lastSocialRefreshAt ?? undefined,
        message: 'Snapshots table not set up',
      });
    }

    if (snapErr) {
      console.warn('[influencer growth] snapshot query:', snapErr.message);
    }

    const rows = (snapshots || [])
      .map((s) => {
        const raw = Number(s.total_followers);
        const at = new Date(s.snapshot_at as string).getTime();
        const total = alignFollowerSnapshotToCurrent(raw, currentTotal);
        return { total, at };
      })
      .filter((s): s is { total: number; at: number } => s.total != null && Number.isFinite(s.at) && s.total > 0);

    const now = Date.now();
    const windowMs = FOLLOWER_GROWTH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const minFallbackAgeMs = 7 * 24 * 60 * 60 * 1000;

    const baselineWindow = rows.find((s) => now - s.at >= windowMs);
    const fallback = [...rows].reverse().find((s) => now - s.at >= minFallbackAgeMs);
    const baseline = baselineWindow || fallback;

    let growth: number | null = null;
    let growthPct: number | null = null;
    const oldTotal = baseline?.total ?? null;

    if (oldTotal != null) {
      growth = Math.round(currentTotal - oldTotal);
      growthPct = Math.round((growth / oldTotal) * 1000) / 10;
    }

    const series = buildFollowerGrowthSeries(rows, currentTotal);
    const latestSnapshotAt =
      typeof snapshots?.[0]?.snapshot_at === 'string' ? snapshots[0].snapshot_at : null;
    // Prefer the social-refresh stamp; fall back to newest follower snapshot.
    const statsUpdatedAt = lastSocialRefreshAt || latestSnapshotAt || null;

    return NextResponse.json({
      currentTotal,
      oldTotal: oldTotal ?? undefined,
      growth: growth ?? undefined,
      growthPct: growthPct ?? undefined,
      series,
      statsUpdatedAt: statsUpdatedAt ?? undefined,
    });
  } catch (err) {
    console.error('[influencer growth]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
