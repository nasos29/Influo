/**
 * Top 5 influencers by a composite score (fairer: not just clicks).
 * Uses last N days of analytics. Score = weighted sum of UNIQUE users per event type (at most one per user per event per influencer).
 *   proposal_sent (10) > conversation_started (5) > message_sent (4) > profile_click (3) > profile_view (1)
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

type AnalyticsRow = { id?: string; influencer_id?: string | null; event_type?: string | null; brand_email?: string | null; visitor_id?: string | null };

export async function GET() {
  try {
    const days = Math.max(1, parseInt(process.env.TOP_INFLUENCERS_DAYS || String(DEFAULT_DAYS), 10) || DEFAULT_DAYS);
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceIso = since.toISOString();

    let events: AnalyticsRow[] | null = null;
    let eventsErr: { message: string } | null = null;
    let sel = supabaseAdmin
      .from('influencer_analytics')
      .select('id, influencer_id, event_type, brand_email, visitor_id')
      .gte('created_at', sinceIso)
      .in('event_type', Object.keys(EVENT_WEIGHTS));
    const res = await sel;
    eventsErr = res.error;
    events = res.data as AnalyticsRow[] | null;

    if (eventsErr && /visitor_id|column/i.test(eventsErr.message)) {
      const res2 = await supabaseAdmin
        .from('influencer_analytics')
        .select('id, influencer_id, event_type, brand_email')
        .gte('created_at', sinceIso)
        .in('event_type', Object.keys(EVENT_WEIGHTS));
      eventsErr = res2.error;
      events = (res2.data ?? []).map((r: { id?: string; influencer_id?: string | null; event_type?: string | null; brand_email?: string | null }) => ({ ...r, visitor_id: null }));
    }

    if (eventsErr) {
      console.error('[top-influencers] Analytics error:', eventsErr);
      return NextResponse.json({ influencers: [] });
    }

    const eventsList: AnalyticsRow[] = events ?? [];
    const scores: Record<string, number> = {};
    const uniq: Record<string, Set<string>> = {};
    eventsList.forEach((e: AnalyticsRow) => {
      const id = e.influencer_id != null ? String(e.influencer_id).trim().toLowerCase() : null;
      if (!id) return;
      const userKey = (e.brand_email || '').trim() || (e.visitor_id || '').trim() || (e.id != null ? String(e.id) : '');
      const key = `${id}\t${e.event_type || ''}`;
      if (!uniq[key]) uniq[key] = new Set();
      if (userKey && uniq[key].has(userKey)) return;
      uniq[key].add(userKey);
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
