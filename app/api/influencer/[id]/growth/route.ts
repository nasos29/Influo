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
    const thirtyIso = thirtyDaysAgo.toISOString();

    const { data: snapshot30, error: snapErr } = await supabaseAdmin
      .from('influencer_follower_snapshots')
      .select('total_followers, snapshot_at')
      .eq('influencer_id', id)
      .lte('snapshot_at', thirtyIso)
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

    // If every snapshot is newer than T−30d (common right after snapshots ship, or rare
    // refreshes), fall back to the earliest snapshot so the card is not blank — still a
    // meaningful delta vs first recorded total, as long as it is not same-moment noise.
    let snapshot = snapshot30;
    if (!snapshot30) {
      const { data: oldest, error: oldErr } = await supabaseAdmin
        .from('influencer_follower_snapshots')
        .select('total_followers, snapshot_at')
        .eq('influencer_id', id)
        .order('snapshot_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!oldErr && oldest?.snapshot_at) {
        const at = new Date(oldest.snapshot_at as string).getTime();
        const ageMs = Date.now() - at;
        const MIN_FALLBACK_BASELINE_MS = 24 * 60 * 60 * 1000;
        if (Number.isFinite(at) && ageMs >= MIN_FALLBACK_BASELINE_MS) {
          snapshot = oldest;
        }
      }
    }

    // Postgres BIGINT may arrive as string; normalize.
    const rawOld = snapshot?.total_followers;
    const oldTotal =
      rawOld == null ? null : Number(rawOld);
    let growth: number | null = null;
    let growthPct: number | null = null;

    // Compare to the newest snapshot at or before T−30d. Do not cap how old that
    // baseline may be: a 45d max-age here combined with "lte 30d ago" left only a
    // ~15d window and hid growth for most sparse snapshot schedules.
    if (oldTotal != null && Number.isFinite(oldTotal) && oldTotal > 0) {
      growth = currentTotal - oldTotal;
      growthPct = (growth / oldTotal) * 100;
    }

    return NextResponse.json({
      currentTotal,
      oldTotal:
        oldTotal != null && Number.isFinite(oldTotal) ? oldTotal : undefined,
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
