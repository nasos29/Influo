/**
 * Newly approved influencers for homepage section (last 4).
 * Same data shape as Directory: select('*') so images and badges work.
 */

import { NextResponse } from 'next/server';
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

const LIMIT = 4;

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('influencers')
      .select('*')
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(LIMIT);

    if (error) {
      console.error('[newly-approved] Supabase error:', error.message, error.details);
      return NextResponse.json(
        { error: error.message, influencers: [] },
        { status: 200 }
      );
    }

    const list = Array.isArray(data) ? data : [];
    return NextResponse.json({ influencers: list });
  } catch (err: unknown) {
    console.error('[newly-approved] Exception:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error', influencers: [] },
      { status: 200 }
    );
  }
}
