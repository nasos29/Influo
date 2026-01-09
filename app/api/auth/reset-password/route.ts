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
    const { email, redirectTo } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Generate password reset link without sending email
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: redirectTo || `${process.env.NEXT_PUBLIC_SITE_URL || 'https://influo.gr'}/reset-password`,
      }
    });

    if (error) {
      console.error('Error generating reset link:', error);
      return NextResponse.json(
        { error: 'Failed to generate reset link', details: error.message },
        { status: 500 }
      );
    }

    // Return the properties link that contains the reset token
    return NextResponse.json({
      success: true,
      resetLink: data.properties.action_link,
    });
  } catch (error: any) {
    console.error('Error in reset-password API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

