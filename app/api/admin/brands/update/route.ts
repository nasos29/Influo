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
    const { brandId, brand_name, contact_person, website, industry, logo_url } = await request.json();

    if (!brandId) {
      return NextResponse.json(
        { error: 'brandId is required' },
        { status: 400 }
      );
    }

    // Build update object with only provided fields
    const updateData: any = {};
    if (brand_name !== undefined) updateData.brand_name = brand_name;
    if (contact_person !== undefined) updateData.contact_person = contact_person;
    if (website !== undefined) updateData.website = website;
    if (industry !== undefined) updateData.industry = industry;
    if (logo_url !== undefined) updateData.logo_url = logo_url;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update brand
    const { data, error } = await supabaseAdmin
      .from('brands')
      .update(updateData)
      .eq('id', brandId)
      .select()
      .single();

    if (error) {
      console.error('Error updating brand:', error);
      return NextResponse.json(
        { error: 'Failed to update brand', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, brand: data });
  } catch (error: any) {
    console.error('Error in brand update API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

