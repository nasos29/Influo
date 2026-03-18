// Trigger push notification when a new proposal is sent to an influencer
// Called from influencer profile page (client) after proposal insert

import { NextResponse } from 'next/server';
import { sendPushToInfluencer } from '@/lib/push';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { influencerId, brandName, proposalType, budget } = body;

    if (!influencerId) {
      return NextResponse.json({ error: 'Missing influencerId' }, { status: 400 });
    }

    await sendPushToInfluencer(String(influencerId), {
      title: '📨 Νέα Πρόταση Συνεργασίας',
      body: `${brandName || 'Brand'}: ${proposalType || 'Συνεργασία'} | €${budget || ''}`,
      url: '/dashboard',
      tag: 'proposal',
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[Push Trigger Proposal]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
