import type { SupabaseClient } from '@supabase/supabase-js';

/** Persist admin-visible note from lenient Insights check (optional column fallback). */
export async function writeApproveNewInsightsAdminNote(
  supabaseAdmin: SupabaseClient,
  influencerId: string,
  note: string | null
): Promise<void> {
  const trimmed = String(note || '').trim();
  if (!trimmed) return;
  const patch = { analytics_verification_notes: trimmed };
  let { error } = await supabaseAdmin.from('influencers').update(patch).eq('id', influencerId);
  if (error && /column|analytics_verification_notes/i.test(error.message)) {
    ({ error } = await supabaseAdmin
      .from('influencers')
      .update({ approval_notes: trimmed })
      .eq('id', influencerId));
  }
  if (error) {
    console.warn('[approve-new] insights admin note', error.message);
  }
}