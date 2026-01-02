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

export async function GET(request: NextRequest) {
  try {
    // Fetch all brands using admin privileges (bypasses RLS)
    const { data: brands, error } = await supabaseAdmin
      .from('brands')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching brands:', error);
      return NextResponse.json(
        { error: 'Failed to fetch brands', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, brands: brands || [] });
  } catch (error: any) {
    console.error('Error in brands API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

