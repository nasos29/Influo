/**
 * Top 5 influencers of the month by profile clicks (last 30 days).
 * Falls back to profile views, then newest approved if no analytics.
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

    // 1. Get profile_click events from last 30 days
    const { data: clickEvents, error: clickErr } = await supabaseAdmin
      .from('influencer_analytics')
      .select('influencer_id')
      .eq('event_type', 'profile_click')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (clickErr) {
      console.error('[top-influencers] Click events error:', clickErr);
    }

    // 2. Get profile_view events (fallback)
    const { data: viewEvents, error: viewErr } = await supabaseAdmin
      .from('influencer_analytics')
      .select('influencer_id')
      .eq('event_type', 'profile_view')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (viewErr) {
      console.error('[top-influencers] View events error:', viewErr);
    }

    // Count clicks and views per influencer
    const clickCounts: Record<string, number> = {};
    const viewCounts: Record<string, number> = {};
    clickEvents?.forEach((e: { influencer_id: string }) => {
      clickCounts[e.influencer_id] = (clickCounts[e.influencer_id] || 0) + 1;
    });
    viewEvents?.forEach((e: { influencer_id: string }) => {
      viewCounts[e.influencer_id] = (viewCounts[e.influencer_id] || 0) + 1;
    });

    // Sort: by clicks desc, then by views desc, then by id for stability
    const allIds = new Set([...Object.keys(clickCounts), ...Object.keys(viewCounts)]);
    const sortedIds = Array.from(allIds).sort((a, b) => {
      const clA = clickCounts[a] || 0;
      const clB = clickCounts[b] || 0;
      if (clB !== clA) return clB - clA;
      const vA = viewCounts[a] || 0;
      const vB = viewCounts[b] || 0;
      return vB - vA;
    }).slice(0, 5);

    let influencerIds = sortedIds;

    // If fewer than 5, fill with newest approved influencers
    if (influencerIds.length < 5) {
      const { data: fallbackInf } = await supabaseAdmin
        .from('influencers')
        .select('id')
        .eq('approved', true)
        .order('created_at', { ascending: false })
        .limit(10);

      const existing = new Set(influencerIds);
      const toAdd = (fallbackInf || [])
        .map((r: { id: string }) => r.id)
        .filter((id: string) => !existing.has(id));
      influencerIds = [...influencerIds, ...toAdd].slice(0, 5);
    }

    if (influencerIds.length === 0) {
      return NextResponse.json({ influencers: [] });
    }

    // 3. Fetch influencer details
    const { data: influencers, error: infErr } = await supabaseAdmin
      .from('influencers')
      .select('id, display_name, display_name_en, avatar_url, videos, video_thumbnails, accounts, category')
      .eq('approved', true)
      .in('id', influencerIds);

    if (infErr) {
      console.error('[top-influencers] Influencers fetch error:', infErr);
      return NextResponse.json(
        { error: infErr.message },
        { status: 500 }
      );
    }

    // Order to match sortedIds and attach clicks/views
    const orderMap = Object.fromEntries(influencerIds.map((id, i) => [id, i]));
    const ordered = (influencers || []).sort(
      (a, b) => (orderMap[a.id] ?? 999) - (orderMap[b.id] ?? 999)
    ).map((inf) => ({
      ...inf,
      clicks: clickCounts[inf.id] || 0,
      views: viewCounts[inf.id] || 0
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
