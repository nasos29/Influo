import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

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

    // 1. Ελέγχουμε αν υπάρχει στο influencers table
    const { data: influencerData } = await supabaseAdmin
      .from('influencers')
      .select('id, contact_email')
      .eq('contact_email', email)
      .maybeSingle();

    // Αν υπάρχει στο influencers, δεν είναι orphaned - return error
    if (influencerData) {
      return NextResponse.json(
        { error: 'Email exists in influencers table. Cannot delete.', exists: true },
        { status: 400 }
      );
    }

    // 2. Βρίσκουμε το auth user με αυτό το email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      return NextResponse.json(
        { error: 'Failed to list users', details: listError.message },
        { status: 500 }
      );
    }

    const authUser = users.find(u => u.email === email);

    if (!authUser) {
      // Δεν υπάρχει auth user - όλα καλά
      return NextResponse.json({
        success: true,
        message: 'No orphaned auth user found. Email is clean.',
        deleted: false
      });
    }

    // 3. Διαγραφή από user_roles ΠΡΩΤΑ (για να μην σπάσει το foreign key)
    const { error: rolesDeleteError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('id', authUser.id);

    if (rolesDeleteError) {
      console.error('Error deleting from user_roles:', rolesDeleteError);
    }

    // 4. Διαγράφουμε το orphaned auth user
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete auth user', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Orphaned auth user deleted successfully',
      deleted: true,
      userId: authUser.id
    });
  } catch (error: any) {
    console.error('Error in cleanup-orphaned-auth API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

