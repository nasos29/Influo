/**
 * Top 5 influencers of the month by profile clicks only (last 30 days).
 * Only influencers with at least one profile_click appear. No fallback to random/approved.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function GET() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: clickEvents, error: clickErr } = await supabaseAdmin
      .from('influencer_analytics')
      .select('influencer_id')
      .eq('event_type', 'profile_click')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (clickErr) {
      console.error('[top-influencers] Click events error:', clickErr);
      return NextResponse.json({ influencers: [] });
    }

    const clickCounts: Record<string, number> = {};
    clickEvents?.forEach((e: { influencer_id: string }) => {
      clickCounts[e.influencer_id] = (clickCounts[e.influencer_id] || 0) + 1;
    });

    // Only influencers with at least 1 click; sort by clicks desc, top 5
    const sortedIds = Object.entries(clickCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    if (sortedIds.length === 0) {
      return NextResponse.json({ influencers: [] });
    }

    const { data: influencers, error: infErr } = await supabaseAdmin
      .from('influencers')
      .select('id, display_name, display_name_en, avatar_url, videos, video_thumbnails, accounts, category')
      .eq('approved', true)
      .in('id', sortedIds);

    if (infErr) {
      console.error('[top-influencers] Influencers fetch error:', infErr);
      return NextResponse.json(
        { error: infErr.message },
        { status: 500 }
      );
    }

    const orderMap = Object.fromEntries(sortedIds.map((id, i) => [id, i]));
    const ordered = (influencers || []).sort(
      (a, b) => (orderMap[a.id] ?? 999) - (orderMap[b.id] ?? 999)
    ).map((inf) => ({
      ...inf,
      clicks: clickCounts[inf.id] || 0,
      views: 0
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
