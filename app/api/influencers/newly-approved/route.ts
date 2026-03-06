/**
 * Newly approved influencers for homepage section.
 * Only influencers with approved = true, ordered by created_at desc (newest first).
 * Uses created_at so it works even if approved_at column is missing.
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

const LIMIT = 12;

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('influencers')
      .select('id, display_name, display_name_en, avatar_url, videos, video_thumbnails, accounts, category')
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(LIMIT);

    if (error) {
      console.error('[newly-approved] Error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ influencers: data ?? [] });
  } catch (err: unknown) {
    console.error('[newly-approved]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
