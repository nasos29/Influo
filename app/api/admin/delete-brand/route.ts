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

    // 1. Find auth user by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      // Continue anyway - maybe auth user doesn't exist
    }

    const authUser = users?.find(u => u.email?.toLowerCase() === brandData.contact_email.toLowerCase());

    // 2. Delete from user_roles table (if exists) - for foreign key constraints
    if (authUser) {
      const { error: rolesDeleteError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('id', authUser.id);

      if (rolesDeleteError) {
        console.error('Error deleting from user_roles table:', rolesDeleteError);
        // Continue anyway
      }
    }

    // 3. Delete brand from brands table
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

    // 4. Delete auth user (if exists)
    if (authUser) {
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);

      if (authDeleteError) {
        console.error('Error deleting auth user:', authDeleteError);
        // Return success for brand deletion but warn about auth
        return NextResponse.json({
          success: true,
          message: `Brand ${brandData.brand_name} deleted from database, but auth user deletion failed: ${authDeleteError.message}`,
          warning: 'Auth user may still exist'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Brand ${brandData.brand_name} deleted successfully from both database and auth`
    });
  } catch (error: any) {
    console.error('Error in delete-brand API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

