/**
 * GET /api/influencer/[id]/growth
 * Returns 30-day follower growth for the profile card.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { totalFollowersFromAccounts } from '@/lib/parseFollowers';

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

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: snapshot, error: snapErr } = await supabaseAdmin
      .from('influencer_follower_snapshots')
      .select('total_followers')
      .eq('influencer_id', id)
      .lte('snapshot_at', thirtyDaysAgo.toISOString())
      .order('snapshot_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapErr && /relation|table|does not exist/i.test(snapErr.message)) {
      return NextResponse.json({
        currentTotal,
        oldTotal: null,
        growth: null,
        growthPct: null,
        message: 'Snapshots table not set up',
      });
    }

    const oldTotal = snapshot?.total_followers ?? null;
    let growth: number | null = null;
    let growthPct: number | null = null;
    if (oldTotal != null && typeof oldTotal === 'number' && oldTotal > 0) {
      growth = currentTotal - oldTotal;
      growthPct = (growth / oldTotal) * 100;
    }

    return NextResponse.json({
      currentTotal,
      oldTotal: oldTotal ?? undefined,
      growth: growth ?? undefined,
      growthPct: growthPct != null ? Math.round(growthPct * 10) / 10 : undefined,
    });
  } catch (err) {
    console.error('[influencer growth]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
