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
    const { brandId } = await request.json();

    if (!brandId) {
      return NextResponse.json(
        { error: 'Brand ID is required' },
        { status: 400 }
      );
    }

    // Check if brand exists
    const { data: brandData, error: checkError } = await supabaseAdmin
      .from('brands')
      .select('id, brand_name, contact_email')
      .eq('id', brandId)
      .single();

    if (checkError || !brandData) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    // Delete brand from brands table
    const { error: deleteError } = await supabaseAdmin
      .from('brands')
      .delete()
      .eq('id', brandId);

    if (deleteError) {
      console.error('Error deleting brand:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete brand', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Brand ${brandData.brand_name} deleted successfully`
    });
  } catch (error: any) {
    console.error('Error in delete-brand API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

