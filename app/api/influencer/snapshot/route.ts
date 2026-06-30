import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { insertFollowerSnapshot } from '@/lib/parseFollowers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Insert a follower snapshot for an influencer.
 * POST { influencerId: string, accounts: Array<{ followers?: string | number | null }> }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const influencerId = String(body?.influencerId ?? '').trim();
    const accounts = body?.accounts;

    if (!influencerId || !accounts || !Array.isArray(accounts)) {
      return NextResponse.json({ error: 'influencerId and accounts array required' }, { status: 400 });
    }

    await insertFollowerSnapshot(supabaseAdmin, influencerId, accounts);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    console.error('[influencer/snapshot]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
