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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { influencerId, eventType, brandEmail, brandName, metadata } = body;

    if (!influencerId || !eventType) {
      return NextResponse.json(
        { error: 'influencerId and eventType are required' },
        { status: 400 }
      );
    }

    // Validate event type
    const validEventTypes = ['profile_view', 'profile_click', 'proposal_sent', 'message_sent', 'conversation_started'];
    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json(
        { error: `Invalid eventType. Must be one of: ${validEventTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Insert analytics event (coerce influencerId to string for UUID column)
    const { data, error } = await supabaseAdmin
      .from('influencer_analytics')
      .insert([{
        influencer_id: String(influencerId),
        event_type: eventType,
        brand_email: brandEmail || null,
        brand_name: brandName || null,
        metadata: metadata || {}
      }])
      .select()
      .single();

    if (error) {
      console.error('[Analytics API] Error inserting event:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Analytics API] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
