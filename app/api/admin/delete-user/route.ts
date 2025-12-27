import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Server-side Supabase client με service role key (Admin privileges)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key για admin operations
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // 1. Διαγραφή από τον πίνακα influencers (αν υπάρχει)
    const { error: deleteError } = await supabaseAdmin
      .from('influencers')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('Error deleting from influencers table:', deleteError);
    }

    // 2. Διαγραφή του auth user από το Supabase Auth
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError);
      return NextResponse.json(
        { error: 'Failed to delete auth user', details: authDeleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'User deleted successfully from both database and auth' }
    );
  } catch (error: any) {
    console.error('Error in delete-user API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

