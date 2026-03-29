import { NextResponse } from 'next/server';
import { sendPushInfluencerAccountApproved } from '@/lib/push';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const influencerId =
      body.influencerId != null && body.influencerId !== '' ? String(body.influencerId).trim() : '';
    const displayName =
      typeof body.displayName === 'string' ? body.displayName.trim() : '';
    if (!influencerId || !displayName) {
      return NextResponse.json(
        { error: 'influencerId and displayName required' },
        { status: 400 }
      );
    }
    await sendPushInfluencerAccountApproved(influencerId, displayName);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error('[push/trigger-influencer-approved]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 }
    );
  }
}
