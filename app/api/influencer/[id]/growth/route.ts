/**
 * GET /api/influencer/[id]/growth
 * Returns 15-day follower growth for the profile card.
 * Ignores follower drops caused by removed/lost social accounts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { totalFollowersFromAccounts } from '@/lib/parseFollowers';
import {
  buildFollowerGrowthSeries,
  computeFollowerGrowth,
  snapshotAccountsFromProfile,
  type FollowerSnapshotPoint,
  type SnapshotAccountFollowers,
} from '@/lib/followerGrowth';

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

function parseStoredAccounts(raw: unknown): SnapshotAccountFollowers[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const out: SnapshotAccountFollowers[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const platform = String((row as { platform?: unknown }).platform || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
    const username = String((row as { username?: unknown }).username || '')
      .trim()
      .replace(/^@+/, '')
      .toLowerCase();
    const followers = Number((row as { followers?: unknown }).followers);
    if (!platform || !username || !Number.isFinite(followers) || !(followers > 0)) continue;
    out.push({ platform, username, followers: Math.round(followers) });
  }
  return out.length ? out : null;
}

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

    const accounts = (influencer.accounts as Array<{
      platform?: string | null;
      username?: string | null;
      followers?: string | number | null;
    }>) ?? [];
    const currentAccounts = snapshotAccountsFromProfile(accounts);
    const currentTotal = totalFollowersFromAccounts(accounts);
    const lastSocialRefreshAt =
      typeof influencer.last_social_refresh_at === 'string' ? influencer.last_social_refresh_at : null;

    type SnapshotRow = {
      total_followers?: number | string | null;
      snapshot_at?: string | null;
      accounts?: unknown;
    };
    let snapshots: SnapshotRow[] = [];
    let snapErr: { message?: string } | null = null;

    {
      const full = await supabaseAdmin
        .from('influencer_follower_snapshots')
        .select('total_followers, snapshot_at, accounts')
        .eq('influencer_id', id)
        .order('snapshot_at', { ascending: false })
        .limit(90);
      if (full.error && /accounts|column/i.test(full.error.message || '')) {
        const bare = await supabaseAdmin
          .from('influencer_follower_snapshots')
          .select('total_followers, snapshot_at')
          .eq('influencer_id', id)
          .order('snapshot_at', { ascending: false })
          .limit(90);
        snapshots = (bare.data || []) as SnapshotRow[];
        snapErr = bare.error;
      } else {
        snapshots = (full.data || []) as SnapshotRow[];
        snapErr = full.error;
      }
    }

    if (snapErr && /relation|table|does not exist/i.test(snapErr.message || '')) {
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

    const rows: FollowerSnapshotPoint[] = [];
    for (const s of snapshots) {
      const raw = Number(s.total_followers);
      const at = s.snapshot_at ? new Date(s.snapshot_at).getTime() : NaN;
      if (!(raw > 0) || !Number.isFinite(at)) continue;
      rows.push({
        total: raw,
        at,
        accounts: parseStoredAccounts(s.accounts),
      });
    }

    const growthResult = computeFollowerGrowth(rows, currentAccounts, currentTotal);
    const series = buildFollowerGrowthSeries(
      growthResult?.seriesSource || rows,
      growthResult?.currentTotal ?? currentTotal
    );
    const latestSnapshotAt =
      typeof snapshots[0]?.snapshot_at === 'string' ? snapshots[0].snapshot_at : null;
    const statsUpdatedAt = lastSocialRefreshAt || latestSnapshotAt || null;

    return NextResponse.json({
      currentTotal: growthResult?.currentTotal ?? currentTotal,
      oldTotal: growthResult?.oldTotal,
      growth: growthResult?.growth,
      growthPct: growthResult?.growthPct,
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
