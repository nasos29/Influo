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
    const { emails, adminEmail } = await request.json();

    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json(
        { error: 'emails array is required' },
        { status: 400 }
      );
    }

    const results = [];

    // Get IP and User Agent for audit
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Λήψη όλων των users
    const { data: { users: allUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      return NextResponse.json(
        { error: 'Failed to list users', details: listError.message },
        { status: 500 }
      );
    }

    for (const email of emails) {
      const user = allUsers.find(u => u.email === email);

      if (!user) {
        results.push({
          email,
          success: false,
          error: 'User not found in auth system'
        });
        continue;
      }

      // Get user details BEFORE deletion for audit log
      const { data: influencerData } = await supabaseAdmin
        .from('influencers')
        .select('id, display_name, contact_email, created_at, verified, approved')
        .eq('id', user.id)
        .maybeSingle();

      // 1. Διαγραφή από user_roles ΠΡΩΤΑ
      const { error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('id', user.id);

      if (rolesError) {
        console.error('[CLEANUP TEST USERS] Error deleting from user_roles:', rolesError);
      }

      // 2. Διαγραφή από influencers table
      const { error: dbError } = await supabaseAdmin
        .from('influencers')
        .delete()
        .eq('id', user.id);

      // 3. Διαγραφή auth user
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

      if (authError || dbError) {
        results.push({
          email,
          success: false,
          errors: {
            auth: authError?.message,
            db: dbError?.message
          }
        });
      } else {
        results.push({
          email,
          success: true,
          message: 'User deleted successfully'
        });

        // Log to audit table (if exists)
        try {
          await supabaseAdmin
            .from('admin_audit_log')
            .insert({
              action_type: 'delete_user',
              admin_email: adminEmail || 'unknown',
              target_type: 'influencer',
              target_id: user.id,
              target_email: influencerData?.contact_email || email,
              target_name: influencerData?.display_name || 'unknown',
              details: {
                influencer_data: influencerData,
                auth_email: email,
                verified: influencerData?.verified,
                approved: influencerData?.approved,
                created_at: influencerData?.created_at,
                cleanup_batch: true
              },
              ip_address: ipAddress,
              user_agent: userAgent
            });
        } catch (auditError) {
          // Don't fail the deletion if audit log fails
          console.error('[CLEANUP TEST USERS] Error writing to audit log:', auditError);
        }

        // Console log for immediate visibility
        console.log(`[CLEANUP TEST USERS] User deleted: ${influencerData?.display_name || 'unknown'} (${email}) by admin: ${adminEmail || 'unknown'} at ${new Date().toISOString()}`);
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: emails.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
  } catch (error: any) {
    console.error('Error in cleanup-test-users API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

