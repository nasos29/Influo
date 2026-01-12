import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Save profile changes when influencer edits their profile
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { influencerId, oldValues, newValues, changedFields } = body;

    if (!influencerId || !oldValues || !newValues || !changedFields) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Insert the change record
    const { data, error } = await supabaseAdmin
      .from('profile_changes')
      .insert({
        influencer_id: influencerId,
        old_values: oldValues,
        new_values: newValues,
        changed_fields: changedFields,
        reviewed_by_admin: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving profile changes:', error);
      return NextResponse.json(
        { error: 'Failed to save profile changes', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error in profile-changes POST:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// Get profile changes for an influencer (for admin review)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const influencerId = searchParams.get('influencerId');
    const unreviewedOnly = searchParams.get('unreviewedOnly') === 'true';

    if (!influencerId) {
      return NextResponse.json(
        { error: 'Missing influencerId parameter' },
        { status: 400 }
      );
    }

    console.log('[Profile Changes API] Fetching changes for influencer:', influencerId, 'unreviewedOnly:', unreviewedOnly);

    let query = supabaseAdmin
      .from('profile_changes')
      .select('*')
      .eq('influencer_id', influencerId)
      .order('created_at', { ascending: false });

    if (unreviewedOnly) {
      query = query.eq('reviewed_by_admin', false);
    }

    const { data, error } = await query;
    
    console.log('[Profile Changes API] Query result:', { dataCount: data?.length || 0, error: error?.message });

    if (error) {
      console.error('Error fetching profile changes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch profile changes', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Error in profile-changes GET:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// Mark changes as reviewed by admin
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { changeIds } = body; // Array of change IDs to mark as reviewed

    if (!changeIds || !Array.isArray(changeIds) || changeIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid changeIds' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('profile_changes')
      .update({
        reviewed_by_admin: true,
        reviewed_at: new Date().toISOString()
      })
      .in('id', changeIds)
      .select();

    if (error) {
      console.error('Error updating profile changes:', error);
      return NextResponse.json(
        { error: 'Failed to update profile changes', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Error in profile-changes PATCH:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
