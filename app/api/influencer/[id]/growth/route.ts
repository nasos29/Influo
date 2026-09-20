/**
 * GET /api/influencer/[id]/growth
 * Returns 30-day follower growth for the profile card.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isPlausibleFollowerBaseline, totalFollowersFromAccounts } from '@/lib/parseFollowers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const { data: influencer, error: infErr } = await supabaseAdmin
      .from('influencers')
      .select('id, accounts')
      .eq('id', id)
      .maybeSingle();

    if (infErr || !influencer) {
      return NextResponse.json({ error: 'Influencer not found' }, { status: 404 });
    }

    const accounts = (influencer.accounts as Array<{ followers?: string | number | null }>) ?? [];
    const currentTotal = totalFollowersFromAccounts(accounts);

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
        message: 'Snapshots table not set up',
      });
    }

    if (snapErr) {
      console.warn('[influencer growth] snapshot query:', snapErr.message);
    }

    const rows = (snapshots || [])
      .map((s) => ({
        total: Number(s.total_followers),
        at: new Date(s.snapshot_at as string).getTime(),
      }))
      .filter((s) => Number.isFinite(s.total) && Number.isFinite(s.at) && s.total > 0);

    const now = Date.now();
    const thirtyMs = 30 * 24 * 60 * 60 * 1000;
    const minFallbackAgeMs = 7 * 24 * 60 * 60 * 1000;

    const plausible = rows.filter((s) => isPlausibleFollowerBaseline(s.total, currentTotal));
    const baseline30 = plausible.find((s) => now - s.at >= thirtyMs);
    const fallback = [...plausible].reverse().find((s) => now - s.at >= minFallbackAgeMs);
    const baseline = baseline30 || fallback;

    let growth: number | null = null;
    let growthPct: number | null = null;
    const oldTotal = baseline?.total ?? null;

    if (oldTotal != null) {
      growth = currentTotal - oldTotal;
      const pct = (growth / oldTotal) * 100;
      if (Math.abs(pct) <= 250) {
        growthPct = Math.round(pct * 10) / 10;
      }
    }

    return NextResponse.json({
      currentTotal,
      oldTotal: oldTotal ?? undefined,
      growth: growth ?? undefined,
      growthPct: growthPct ?? undefined,
    });
  } catch (err) {
    console.error('[influencer growth]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
