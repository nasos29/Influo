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

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header from the request
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ profile: null });
    }

    const token = authHeader.replace('Bearer ', '');

    // Create a client with the user's token
    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    // Get the user from the token
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ profile: null });
    }

    // Check if user is influencer (using admin client to bypass RLS)
    const { data: influencerData } = await supabaseAdmin
      .from('influencers')
      .select('avatar_url, display_name')
      .eq('contact_email', user.email)
      .maybeSingle();

    if (influencerData) {
      return NextResponse.json({
        profile: {
          type: 'influencer',
          avatar_url: influencerData.avatar_url,
          display_name: influencerData.display_name
        }
      });
    }

    // Check if user is brand (using admin client to bypass RLS)
    const { data: brandDataByContact } = await supabaseAdmin
      .from('brands')
      .select('logo_url, brand_name')
      .ilike('contact_email', user.email || '')
      .maybeSingle();

    if (brandDataByContact) {
      return NextResponse.json({
        profile: {
          type: 'brand',
          logo_url: brandDataByContact.logo_url,
          brand_name: brandDataByContact.brand_name
        }
      });
    }

    // Try email field for brands
    const { data: brandDataByEmail } = await supabaseAdmin
      .from('brands')
      .select('logo_url, brand_name')
      .ilike('email', user.email || '')
      .maybeSingle();

    if (brandDataByEmail) {
      return NextResponse.json({
        profile: {
          type: 'brand',
          logo_url: brandDataByEmail.logo_url,
          brand_name: brandDataByEmail.brand_name
        }
      });
    }

    return NextResponse.json({ profile: null });
  } catch (err: any) {
    console.error('[API /api/user/profile] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error', profile: null },
      { status: 500 }
    );
  }
}
