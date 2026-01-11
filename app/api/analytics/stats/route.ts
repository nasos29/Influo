import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const influencerId = searchParams.get('influencerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!influencerId) {
      return NextResponse.json(
        { error: 'influencerId is required' },
        { status: 400 }
      );
    }

    // Build query with date filters
    let query = supabaseAdmin
      .from('influencer_analytics')
      .select('*')
      .eq('influencer_id', influencerId);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: events, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('[Analytics Stats API] Error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Calculate stats
    const stats = {
      profileViews: events?.filter(e => e.event_type === 'profile_view').length || 0,
      profileClicks: events?.filter(e => e.event_type === 'profile_click').length || 0,
      proposalsSent: events?.filter(e => e.event_type === 'proposal_sent').length || 0,
      messagesSent: events?.filter(e => e.event_type === 'message_sent').length || 0,
      conversationsStarted: events?.filter(e => e.event_type === 'conversation_started').length || 0,
      totalEvents: events?.length || 0,
      eventsByDate: {} as Record<string, { views: number; clicks: number; proposals: number; messages: number; conversations: number }>
    };

    // Group events by date
    events?.forEach(event => {
      const date = new Date(event.created_at).toISOString().split('T')[0];
      if (!stats.eventsByDate[date]) {
        stats.eventsByDate[date] = { views: 0, clicks: 0, proposals: 0, messages: 0, conversations: 0 };
      }
      
      if (event.event_type === 'profile_view') stats.eventsByDate[date].views++;
      if (event.event_type === 'profile_click') stats.eventsByDate[date].clicks++;
      if (event.event_type === 'proposal_sent') stats.eventsByDate[date].proposals++;
      if (event.event_type === 'message_sent') stats.eventsByDate[date].messages++;
      if (event.event_type === 'conversation_started') stats.eventsByDate[date].conversations++;
    });

    return NextResponse.json({ stats, events: events || [] });
  } catch (err: any) {
    console.error('[Analytics Stats API] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
