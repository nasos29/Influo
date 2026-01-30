/**
 * Admin dashboard: refresh social stats (followers, engagement_rate, avg_likes) for one or all influencers.
 * Called from the admin UI button – no CRON_SECRET needed.
 *
 * POST body: { influencerId?: string } – if omitted, refreshes all due (last_social_refresh_at > 30 days ago).
 * When instagramOverrides is set (browser fetched from local Auditpr), Instagram uses those. Otherwise server uses AUDITPR_BASE_URL.
 * TikTok: uses APIFY_API_TOKEN on server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { doRefreshSocialStats, type InstagramOverrides } from '@/lib/refreshSocialStats';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function POST(request: NextRequest) {
  try {
    let influencerId: string | null = null;
    let instagramOverrides: InstagramOverrides | undefined;
    try {
      const body = await request.json().catch(() => ({}));
      influencerId = (body?.influencerId ?? '').trim() || null;
      if (body?.instagramOverrides && typeof body.instagramOverrides === 'object') {
        instagramOverrides = body.instagramOverrides as InstagramOverrides;
      }
    } catch {
      // no body
    }

    const auditprBaseUrl = (process.env.AUDITPR_BASE_URL || '').trim();
    const apifyToken = (process.env.APIFY_API_TOKEN || '').trim();

    const result = await doRefreshSocialStats(supabaseAdmin, {
      influencerId,
      auditprBaseUrl,
      apifyToken,
      instagramOverrides,
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('[admin refresh-social-stats]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
