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
    const { influencerId, eventType, brandEmail, brandName, visitorId, metadata } = body;

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

    const visitorIdTrimmed = typeof visitorId === 'string' ? visitorId.trim() || null : null;

    // Insert analytics event (coerce influencerId to string for UUID column)
    const payload: Record<string, unknown> = {
      influencer_id: String(influencerId),
      event_type: eventType,
      brand_email: brandEmail || null,
      brand_name: brandName || null,
      metadata: metadata || {}
    };
    if (visitorIdTrimmed != null) payload.visitor_id = visitorIdTrimmed;

    let result = await supabaseAdmin.from('influencer_analytics').insert([payload]).select().single();

    if (result.error && /visitor_id|column/i.test(result.error.message)) {
      delete payload.visitor_id;
      result = await supabaseAdmin.from('influencer_analytics').insert([payload]).select().single();
    }

    if (result.error && /metadata|column/i.test(result.error.message)) {
      delete payload.metadata;
      result = await supabaseAdmin.from('influencer_analytics').insert([payload]).select().single();
    }

    if (result.error) {
      console.error('[Analytics API] Error inserting event:', result.error);
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }
    const { data } = result;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('[Analytics API] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
