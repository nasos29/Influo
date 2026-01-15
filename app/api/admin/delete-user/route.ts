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
    const { userId, adminEmail } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get user details BEFORE deletion for audit log
    const { data: influencerData } = await supabaseAdmin
      .from('influencers')
      .select('id, display_name, contact_email, created_at, verified, approved')
      .eq('id', userId)
      .maybeSingle();

    const { data: authUserResponse } = await supabaseAdmin.auth.admin.getUserById(userId);
    const authUserData = authUserResponse?.user;

    // Get IP and User Agent for audit
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // 1. Διαγραφή από user_roles ΠΡΩΤΑ (για να μην σπάσει το foreign key constraint)
    const { error: rolesDeleteError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('id', userId);

    if (rolesDeleteError) {
      console.error('[DELETE USER] Error deleting from user_roles table:', rolesDeleteError);
    }

    // 2. Διαγραφή από τον πίνακα influencers (αν υπάρχει)
    const { error: deleteError } = await supabaseAdmin
      .from('influencers')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      console.error('[DELETE USER] Error deleting from influencers table:', deleteError);
    }

    // 3. Διαγραφή του auth user από το Supabase Auth
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error('[DELETE USER] Error deleting auth user:', authDeleteError);
      return NextResponse.json(
        { error: 'Failed to delete auth user', details: authDeleteError.message },
        { status: 500 }
      );
    }

    // 4. Log to audit table (if exists)
    try {
      await supabaseAdmin
        .from('admin_audit_log')
        .insert({
          action_type: 'delete_user',
          admin_email: adminEmail || 'unknown',
          target_type: 'influencer',
          target_id: userId,
          target_email: influencerData?.contact_email || authUserData?.email || 'unknown',
          target_name: influencerData?.display_name || 'unknown',
          details: {
            influencer_data: influencerData,
            auth_email: authUserData?.email || null,
            verified: influencerData?.verified,
            approved: influencerData?.approved,
            created_at: influencerData?.created_at
          },
          ip_address: ipAddress,
          user_agent: userAgent
        });
    } catch (auditError) {
      // Don't fail the deletion if audit log fails, but log it
      console.error('[DELETE USER] Error writing to audit log (table may not exist):', auditError);
    }

    // 5. Console log for immediate visibility
    console.log(`[DELETE USER] User deleted: ${influencerData?.display_name || 'unknown'} (${influencerData?.contact_email || authUserData?.email || 'unknown'}) by admin: ${adminEmail || 'unknown'} at ${new Date().toISOString()}`);

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

