import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clientIpFromHeaders, hashAnalyticsIp, isBotUserAgent } from '@/lib/analyticsIp';
import { userFromBearer } from '@/lib/apiAuth';

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

async function findInfluencerForUser(userId: string, email: string | null | undefined) {
  const byId = await supabaseAdmin
    .from('influencers')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (byId.data?.id) return String(byId.data.id);

  const byAuth = await supabaseAdmin
    .from('influencers')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle();
  if (byAuth.data?.id) return String(byAuth.data.id);

  const em = (email || '').trim();
  if (!em) return null;
  const byEmail = await supabaseAdmin
    .from('influencers')
    .select('id')
    .ilike('contact_email', em)
    .maybeSingle();
  return byEmail.data?.id ? String(byEmail.data.id) : null;
}

export async function POST(request: NextRequest) {
  try {
    const ua = request.headers.get('user-agent');
    if (isBotUserAgent(ua)) {
      return NextResponse.json({ success: true, skipped: 'bot' });
    }

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

    // Do not record when the viewer is a logged-in influencer (incl. self-views).
    const user = await userFromBearer(request);
    if (user) {
      const viewerInfluencerId = await findInfluencerForUser(user.id, user.email);
      if (viewerInfluencerId) {
        return NextResponse.json({ success: true, skipped: 'influencer' });
      }
    }

    const visitorIdTrimmed = typeof visitorId === 'string' ? visitorId.trim() || null : null;
    const ipHash = hashAnalyticsIp(clientIpFromHeaders(request.headers));

    // Insert analytics event (coerce influencerId to string for UUID column)
    const payload: Record<string, unknown> = {
      influencer_id: String(influencerId),
      event_type: eventType,
      brand_email: brandEmail || null,
      brand_name: brandName || null,
      metadata: metadata || {}
    };
    if (visitorIdTrimmed != null) payload.visitor_id = visitorIdTrimmed;
    if (ipHash) payload.ip_hash = ipHash;

    let result = await supabaseAdmin.from('influencer_analytics').insert([payload]).select().single();

    if (result.error && /ip_hash|column/i.test(result.error.message)) {
      delete payload.ip_hash;
      result = await supabaseAdmin.from('influencer_analytics').insert([payload]).select().single();
    }

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
  } catch (err: unknown) {
    console.error('[Analytics API] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
