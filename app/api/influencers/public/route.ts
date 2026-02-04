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

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('influencers')
      .select('*')
      .eq('approved', true);

    if (error) {
      console.error('[API /api/influencers/public] Error:', error);
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error('[API /api/influencers/public] Exception:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
