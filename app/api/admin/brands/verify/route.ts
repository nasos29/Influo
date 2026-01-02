import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Server-side Supabase client με service role key (Admin privileges)
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

export async function POST(request: NextRequest) {
  try {
    const { brandId, verified } = await request.json();

    if (!brandId || typeof verified !== 'boolean') {
      return NextResponse.json(
        { error: 'brandId and verified (boolean) are required' },
        { status: 400 }
      );
    }

    // Update brand verification status (NO EMAIL SENT)
    const { data, error } = await supabaseAdmin
      .from('brands')
      .update({ verified })
      .eq('id', brandId)
      .select()
      .single();

    if (error) {
      console.error('Error updating brand verification:', error);
      return NextResponse.json(
        { error: 'Failed to update brand verification', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, brand: data });
  } catch (error: any) {
    console.error('Error in brand verify API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

