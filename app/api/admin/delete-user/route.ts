import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { deleteInfluencerAccount } from '@/lib/deleteInfluencerAccount';

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
    const { userId, adminEmail } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const result = await deleteInfluencerAccount(supabaseAdmin, userId, {
      initiator: 'admin',
      actorEmail: adminEmail || 'unknown',
      ipAddress,
      userAgent,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to delete user', details: result.error },
        { status: 500 }
      );
    }

    console.log(`[DELETE USER] User ${userId} deleted by admin: ${adminEmail || 'unknown'} at ${new Date().toISOString()}`);

    return NextResponse.json(
      { success: true, message: 'User deleted successfully from both database and auth' }
    );
  } catch (error: any) {
    console.error('[DELETE USER] Error in delete-user API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

