import { NextResponse } from 'next/server';
import { sendPushAdminNewInfluencerPending } from '@/lib/push';

/** Called after influencer signup so admin gets a push (same trust model as signup_admin email). */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!name || !email) {
      return NextResponse.json({ error: 'name and email required' }, { status: 400 });
    }
    await sendPushAdminNewInfluencerPending(name, email);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error('[push/trigger-admin-new-signup]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 }
    );
  }
}
