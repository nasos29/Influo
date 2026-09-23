/**
 * Admin dashboard: refresh social stats (followers, engagement_rate, avg_likes) for one or all influencers.
 * Called from the admin UI button – no CRON_SECRET needed.
 *
 * GET: returns list of influencers due for refresh (id, display_name, accounts) so the browser can fetch from local Auditpr and then POST.
 * POST body: { influencerId?: string } – if omitted, refreshes all due (last_social_refresh_at > 30 days ago).
 * POST requires instagramOverrides / tiktokOverrides / youtubeOverrides (browser-fetched from Auditpr).
 * Server-side Auditpr scrape is disabled here — it exceeds Vercel maxDuration (60s) and causes FUNCTION_INVOCATION_TIMEOUT.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { doRefreshSocialStats, type InstagramOverrides, type TikTokOverrides, type YouTubeOverrides } from '@/lib/refreshSocialStats';

/** Keep within Vercel Hobby limit (60s without Fluid). */
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/** GET: list influencers due for refresh (for "refresh all" via local Auditpr in browser). */
export async function GET() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: influencers, error } = await supabaseAdmin
      .from('influencers')
      .select('id, display_name, accounts')
      .or(`last_social_refresh_at.is.null,last_social_refresh_at.lt.${thirtyDaysAgo.toISOString()}`);
    if (error) throw new Error(error.message);
    return NextResponse.json({ influencers: influencers ?? [] });
  } catch (err: unknown) {
    console.error('[admin refresh-social-stats GET]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let influencerId: string | null = null;
    let instagramOverrides: InstagramOverrides | undefined;
    let tiktokOverrides: TikTokOverrides | undefined;
    let youtubeOverrides: YouTubeOverrides | undefined;
    try {
      const body = await request.json().catch(() => ({}));
      influencerId = (body?.influencerId ?? '').trim() || null;
      if (body?.instagramOverrides && typeof body.instagramOverrides === 'object') {
        instagramOverrides = body.instagramOverrides as InstagramOverrides;
      }
      if (body?.tiktokOverrides && typeof body.tiktokOverrides === 'object') {
        tiktokOverrides = body.tiktokOverrides as TikTokOverrides;
      }
      if (body?.youtubeOverrides && typeof body.youtubeOverrides === 'object') {
        youtubeOverrides = body.youtubeOverrides as YouTubeOverrides;
      }
    } catch {
      // no body
    }

    const hasOverrides =
      (instagramOverrides && Object.keys(instagramOverrides).length > 0) ||
      (tiktokOverrides && Object.keys(tiktokOverrides).length > 0) ||
      (youtubeOverrides && Object.keys(youtubeOverrides).length > 0);

    // Admin UI scrapes Auditpr in the browser. Never scrape from Vercel — IG/TT
    // alone often exceed maxDuration (60s) and cause FUNCTION_INVOCATION_TIMEOUT.
    if (!hasOverrides) {
      return NextResponse.json(
        {
          error:
            'No Auditpr metrics in request. Refresh from the admin dashboard so the browser can fetch Auditpr first (server-side scrape is disabled to avoid Vercel timeouts).',
        },
        { status: 400 }
      );
    }

    const result = await doRefreshSocialStats(supabaseAdmin, {
      influencerId,
      auditprBaseUrl: '',
      instagramOverrides,
      tiktokOverrides,
      youtubeOverrides,
      overridesOnly: true,
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
