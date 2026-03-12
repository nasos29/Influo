/**
 * Top 5 influencers by a composite score (fairer: not just clicks).
 * Uses last N days of analytics. Score = weighted sum of events:
 *   proposal_sent (10) > conversation_started (5) > message_sent (4) > profile_click (3) > profile_view (1)
 * So creators with real interest (proposals, messages) can rank above those with only many clicks.
 * Env TOP_INFLUENCERS_DAYS (default 30): window in days.
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

const DEFAULT_DAYS = 30;
const TOP_N = 5;

/** Weight per event type – higher = stronger signal of “top” performer. */
const EVENT_WEIGHTS: Record<string, number> = {
  profile_view: 1,
  profile_click: 3,
  message_sent: 4,
  conversation_started: 5,
  proposal_sent: 10,
};

export async function GET() {
  try {
    const days = Math.max(1, parseInt(process.env.TOP_INFLUENCERS_DAYS || String(DEFAULT_DAYS), 10) || DEFAULT_DAYS);
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceIso = since.toISOString();

    const { data: events, error: eventsErr } = await supabaseAdmin
      .from('influencer_analytics')
      .select('influencer_id, event_type')
      .gte('created_at', sinceIso)
      .in('event_type', Object.keys(EVENT_WEIGHTS));

    if (eventsErr) {
      console.error('[top-influencers] Analytics error:', eventsErr);
      return NextResponse.json({ influencers: [] });
    }

    const scores: Record<string, number> = {};
    events?.forEach((e: { influencer_id?: string | null; event_type?: string }) => {
      const id = e.influencer_id != null ? String(e.influencer_id).trim().toLowerCase() : null;
      if (!id) return;
      const w = EVENT_WEIGHTS[e.event_type || ''] ?? 0;
      scores[id] = (scores[id] ?? 0) + w;
    });

    const sortedIds = Object.entries(scores)
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([id]) => id);

    if (sortedIds.length === 0) {
      return NextResponse.json({ influencers: [] });
    }

    const { data: influencers, error: infErr } = await supabaseAdmin
      .from('influencers')
      .select('id, display_name, avatar_url, videos, video_thumbnails, accounts, category')
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
    const idKey = (id: string) => String(id).trim().toLowerCase();
    const ordered = (influencers || []).sort(
      (a, b) => (orderMap[idKey(a.id)] ?? 999) - (orderMap[idKey(b.id)] ?? 999)
    ).map((inf) => ({
      ...inf,
      clicks: Math.round(scores[idKey(inf.id)] ?? 0),
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
