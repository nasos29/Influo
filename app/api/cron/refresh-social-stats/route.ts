/**
 * Refresh social stats (followers, engagement_rate, avg_likes) for influencers.
 * - Instagram: fetched via Auditpr API (no Apify cost; Auditpr must be running with valid IG session).
 * - TikTok: fetched directly via Apify from Influo (use sparingly – has cost).
 *
 * Cron: call with CRON_SECRET in Authorization header.
 * Dashboard: use POST /api/admin/refresh-social-stats instead (no secret needed).
 *
 * Env: AUDITPR_BASE_URL, APIFY_API_TOKEN (for TikTok), optional CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { doRefreshSocialStats } from '@/lib/refreshSocialStats';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const auth = request.headers.get('authorization');
      if (auth !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    const influencerId = searchParams.get('influencerId')?.trim() || null;
    const auditprBaseUrl = (process.env.AUDITPR_BASE_URL || '').trim();
    const apifyToken = (process.env.APIFY_API_TOKEN || '').trim();

    const result = await doRefreshSocialStats(supabaseAdmin, {
      influencerId,
      auditprBaseUrl,
      apifyToken,
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('[refresh-social-stats]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
