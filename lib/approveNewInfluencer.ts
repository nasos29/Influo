import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { sendPushInfluencerAccountApproved } from '@/lib/push';
import { ensureBilingualBio } from '@/lib/bioTranslate';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function markProfileChangesReviewed(supabaseAdmin: SupabaseClient, influencerId: string) {
  const { data } = await supabaseAdmin
    .from('profile_changes')
    .select('id')
    .eq('influencer_id', influencerId)
    .eq('reviewed_by_admin', false);
  const ids = (data || []).map((r: { id: string }) => r.id);
  if (!ids.length) return;
  await supabaseAdmin
    .from('profile_changes')
    .update({ reviewed_by_admin: true, reviewed_at: new Date().toISOString() })
    .in('id', ids);
}

async function sendApprovedEmail(email: string, name: string) {
  if (!process.env.RESEND_API_KEY || !email) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const safeName = escapeHtml(name);
  await resend.emails.send({
    from: 'noreply@influo.gr',
    to: email,
    subject: 'Συγχαρητήρια! Το προφίλ σου εγκρίθηκε ✅',
    html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #065f46; font-size: 22px; font-weight: 700; margin: 0; padding: 0;">✅ Είσαι Live!</h1>
          </div>
          <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="margin: 0 0 16px 0; font-size: 14px;">Γεια σου ${safeName},</p>
            <p style="margin: 0 0 20px 0; font-size: 13px; color: #4b5563;">Συγχαρητήρια! Το προφίλ σου ελέγχθηκε και είναι πλέον ενεργό στο Directory μας. Τα Brands μπορούν τώρα να σε βρουν!</p>
            <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 13px; color: #065f46; font-weight: 600;">🎉 Το προφίλ σου είναι δημόσιο!</p>
            </div>
            <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">Καλή επιτυχία,<br/>Η ομάδα του Influo</p>
            </div>
          </div>
        </div>
      `,
  });
}

export async function finalizeNewInfluencerApproval(
  supabaseAdmin: SupabaseClient,
  influencerId: string
): Promise<{ bioNote: string; approved: boolean }> {
  let { data: inf, error } = await supabaseAdmin
    .from('influencers')
    .select('id, display_name, contact_email, approved, approved_at, bio, bio_en')
    .eq('id', influencerId)
    .maybeSingle();
  if (error && /column|approved_at/i.test(error.message)) {
    ({ data: inf, error } = await supabaseAdmin
      .from('influencers')
      .select('id, display_name, contact_email, approved, bio, bio_en')
      .eq('id', influencerId)
      .maybeSingle());
  }
  if (error || !inf) {
    throw new Error(error?.message || 'Influencer not found');
  }
  if (inf.approved || (inf as { approved_at?: string | null }).approved_at) {
    return { bioNote: 'Skipped: already approved before', approved: false };
  }

  let bioNote = 'No bio change';
  try {
    const pair = await ensureBilingualBio(inf.bio, inf.bio_en);
    bioNote = pair.note;
    if (pair.changed) {
      const { error: bioErr } = await supabaseAdmin
        .from('influencers')
        .update({ bio: pair.bio, bio_en: pair.bio_en })
        .eq('id', influencerId);
      if (bioErr) bioNote = `Bio translate failed to save: ${bioErr.message}`;
    }
  } catch (e: unknown) {
    bioNote = `Bio translate skipped: ${e instanceof Error ? e.message : 'error'}`;
  }

  const now = new Date().toISOString();
  let patch: Record<string, unknown> = {
    analytics_verified: true,
    analytics_verified_at: now,
    approved: true,
    approved_at: now,
  };
  let { error: approveErr } = await supabaseAdmin.from('influencers').update(patch).eq('id', influencerId);
  if (approveErr && /column|analytics_verified_at|approved_at/i.test(approveErr.message)) {
    delete patch.analytics_verified_at;
    delete patch.approved_at;
    ({ error: approveErr } = await supabaseAdmin.from('influencers').update(patch).eq('id', influencerId));
  }
  if (approveErr) {
    throw new Error(approveErr.message);
  }

  await markProfileChangesReviewed(supabaseAdmin, influencerId).catch(() => undefined);
  const name = inf.display_name || String(influencerId);
  const email = String(inf.contact_email || '').trim();
  if (email) {
    await sendApprovedEmail(email, name).catch((e) => {
      console.error('[approve-new] email', e);
    });
  }
  await sendPushInfluencerAccountApproved(String(influencerId), name).catch((e) => {
    console.error('[approve-new] push', e);
  });

  return { bioNote, approved: true };
}
