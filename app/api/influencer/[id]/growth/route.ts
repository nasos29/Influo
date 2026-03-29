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
      .select('total_followers, snapshot_at')
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

    if (snapErr) {
      console.warn('[influencer growth] snapshot query:', snapErr.message);
    }

    // Postgres BIGINT may arrive as string; normalize.
    const rawOld = snapshot?.total_followers;
    const oldTotal =
      rawOld == null ? null : Number(rawOld);
    const snapshotAtMs = snapshot?.snapshot_at
      ? new Date(snapshot.snapshot_at as string).getTime()
      : NaN;

    /** Reject baselines older than this: not a meaningful "30-day" comparison. */
    const MAX_BASELINE_AGE_MS = 45 * 24 * 60 * 60 * 1000;
    const baselineTooOld =
      Number.isFinite(snapshotAtMs) &&
      Date.now() - snapshotAtMs > MAX_BASELINE_AGE_MS;

    let growth: number | null = null;
    let growthPct: number | null = null;

    if (
      oldTotal != null &&
      Number.isFinite(oldTotal) &&
      oldTotal > 0 &&
      !baselineTooOld
    ) {
      growth = currentTotal - oldTotal;
      growthPct = (growth / oldTotal) * 100;
    }

    return NextResponse.json({
      currentTotal,
      oldTotal:
        oldTotal != null && Number.isFinite(oldTotal) ? oldTotal : undefined,
      growth: growth ?? undefined,
      growthPct: growthPct != null ? Math.round(growthPct * 10) / 10 : undefined,
      ...(baselineTooOld && snapshot
        ? { message: 'baseline_too_old' as const }
        : {}),
    });
  } catch (err) {
    console.error('[influencer growth]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
