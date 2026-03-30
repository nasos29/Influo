import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Admin: update influencer row (bypasses RLS). Optionally syncs auth.users.email when contact_email changes.
 * POST { influencerId: string, updates: Record<string, unknown> }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const influencerId = String(body?.influencerId ?? '').trim();
    const updates = body?.updates;

    if (!influencerId || !updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return NextResponse.json({ error: 'influencerId and updates object required' }, { status: 400 });
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('influencers')
      .select('id, contact_email')
      .eq('id', influencerId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json(
        { error: fetchErr?.message || 'Influencer not found' },
        { status: 404 }
      );
    }

    const patch = { ...updates } as Record<string, unknown>;
    if (typeof patch.contact_email === 'string') {
      patch.contact_email = patch.contact_email.trim().toLowerCase();
    }

    const { data, error } = await supabaseAdmin
      .from('influencers')
      .update(patch)
      .eq('id', influencerId)
      .select()
      .single();

    if (error) {
      console.error('[admin/influencers/update]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const newEmail =
      typeof patch.contact_email === 'string' ? patch.contact_email : null;
    const oldEmail = String(existing.contact_email ?? '')
      .toLowerCase()
      .trim();

    if (newEmail && newEmail !== oldEmail) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(influencerId, {
        email: newEmail,
      });
      if (authErr) {
        console.error('[admin/influencers/update] auth email sync failed', authErr);
        return NextResponse.json({
          success: true,
          influencer: data,
          warning:
            'Το προφίλ αποθηκεύτηκε, αλλά το email σύνδεσης (Auth) δεν ενημερώθηκε: ' +
            authErr.message +
            ' — ελέγξτε αν το νέο email υπάρχει ήδη σε άλλο λογαριασμό.',
        });
      }
    }

    return NextResponse.json({ success: true, influencer: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Internal error';
    console.error('[admin/influencers/update]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
