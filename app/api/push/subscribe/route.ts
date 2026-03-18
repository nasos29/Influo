import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { subscription, userType, userIdentifier } = body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }
    if (!userType || !['influencer', 'brand'].includes(userType)) {
      return NextResponse.json({ error: 'Invalid userType' }, { status: 400 });
    }
    if (!userIdentifier || typeof userIdentifier !== 'string') {
      return NextResponse.json({ error: 'Invalid userIdentifier' }, { status: 400 });
    }

    const id = userIdentifier.trim().toLowerCase();
    const userAgent = req.headers.get('user-agent') || null;

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(
        {
          user_type: userType,
          user_identifier: id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_agent: userAgent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint', ignoreDuplicates: false }
      );

    if (error) {
      console.error('[Push Subscribe]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[Push Subscribe]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
