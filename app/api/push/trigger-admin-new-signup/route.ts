import { NextResponse } from 'next/server';
import { sendPushAdminNewInfluencerPending } from '@/lib/push';
import { addAdminNotice } from '@/lib/adminNotice';
import { supabaseService } from '@/lib/apiAuth';
import { allowRateLimit, clientIpFromRequest } from '@/lib/simpleRateLimit';

/** Called after influencer signup so admin gets a push (same trust model as signup_admin email). */
export async function POST(req: Request) {
  try {
    if (!allowRateLimit('push-admin-signup', clientIpFromRequest(req), 10, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!name || !email) {
      return NextResponse.json({ error: 'name and email required' }, { status: 400 });
    }
    // In-app notice only for a real pending profile (the endpoint is unauthenticated).
    const { data: pending } = await supabaseService()
      .from('influencers')
      .select('id')
      .ilike('contact_email', email)
      .eq('approved', false)
      .limit(1);
    if (pending?.[0]?.id) {
      await addAdminNotice({
        kind: 'creator_signup',
        title: `Νέα εγγραφή δημιουργού προς έγκριση: ${name.slice(0, 80)}`,
        body: email,
        url: '/admin',
        dedupeKey: `creator_signup:${pending[0].id}`,
      });
    }
    const result = await sendPushAdminNewInfluencerPending(name, email);
    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    console.error('[push/trigger-admin-new-signup]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 }
    );
  }
}
