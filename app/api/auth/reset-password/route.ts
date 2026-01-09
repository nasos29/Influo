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

    // First, find the user by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return NextResponse.json(
        { error: 'Failed to find user', details: listError.message },
        { status: 500 }
      );
    }

    const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate password reset link
    // NOTE: generateLink() still sends an email from Supabase by default.
    // To disable the Supabase email, you must disable it in the Supabase Dashboard:
    // Authentication → Email Templates → "Reset Password" → Disable
    // See docs/DISABLE_SUPABASE_PASSWORD_RESET_EMAIL.md for detailed instructions
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

