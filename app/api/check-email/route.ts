import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check influencers table (case-insensitive)
    const { count: influencerCount } = await supabaseAdmin
      .from('influencers')
      .select('id', { count: 'exact', head: true })
      .ilike('contact_email', email);

    if (influencerCount && influencerCount > 0) {
      return NextResponse.json({
        exists: true,
        message: 'Email is already registered as influencer'
      });
    }

    // 2. Check brands table (both contact_email and email columns, case-insensitive)
    const { count: brandCountByContact } = await supabaseAdmin
      .from('brands')
      .select('id', { count: 'exact', head: true })
      .ilike('contact_email', email);

    if (brandCountByContact && brandCountByContact > 0) {
      return NextResponse.json({
        exists: true,
        message: 'Email is already registered as brand'
      });
    }

    const { count: brandCountByEmail } = await supabaseAdmin
      .from('brands')
      .select('id', { count: 'exact', head: true })
      .ilike('email', email);

    if (brandCountByEmail && brandCountByEmail > 0) {
      return NextResponse.json({
        exists: true,
        message: 'Email is already registered as brand'
      });
    }

    // 3. Check auth.users table (for admin emails and any other auth users)
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (!listError) {
      const authUser = users.find(u => u.email?.toLowerCase().trim() === normalizedEmail);
      if (authUser) {
        return NextResponse.json({
          exists: true,
          message: 'Email is already registered in the system'
        });
      }
    }

    // Email is available
    return NextResponse.json({
      exists: false,
      message: 'Email is available'
    });

  } catch (error: any) {
    console.error('Email check error:', error);
    return NextResponse.json(
      { error: 'Failed to check email', details: error.message },
      { status: 500 }
    );
  }
}
