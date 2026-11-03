import type { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { adminInboxAddress } from '@/lib/adminMessageSummary';
import { sendPushToBrand, getAdminPushRecipient } from '@/lib/push';
import { appendSocialRefreshLog } from '@/lib/socialRefreshLogs';

const EVENT = 'admin_alert_unapproved';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/**
 * Tell ONLY the admin that a new creator was left unapproved, with the reason.
 * Deduped per creator + reason via social_refresh_logs (no schema change). Never throws.
 */
export async function alertAdminUnapproved(
  supabaseAdmin: SupabaseClient,
  opts: { runId: string; influencerId: string; influencerName: string; reason: string }
): Promise<void> {
  try {
    const reason = (opts.reason || 'Άγνωστος λόγος').slice(0, 500);
    const key = `${opts.influencerId}|${reason}`;
    const { data: prior } = await supabaseAdmin
      .from('social_refresh_logs')
      .select('id')
      .eq('event', EVENT)
      .eq('influencer_id', opts.influencerId)
      .eq('message', key)
      .limit(1);
    if (prior && prior.length) return;

    await appendSocialRefreshLog(supabaseAdmin, {
      run_id: opts.runId,
      level: 'info',
      influencer_id: opts.influencerId,
      influencer_name: opts.influencerName,
      event: EVENT,
      message: key,
    });

    const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.influo.gr').replace(/\/$/, '');
    const name = opts.influencerName || 'Creator';

    if (process.env.RESEND_API_KEY) {
      const to = adminInboxAddress(process.env.ADMIN_EMAIL);
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: 'Influo <noreply@influo.gr>',
        to: [to],
        subject: `Δεν εγκρίθηκε: ${name}`,
        html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.6;color:#1f2937;max-width:560px">
<p>Ο νέος creator <strong>${esc(name)}</strong> έμεινε χωρίς έγκριση στον αυτόματο έλεγχο (AuditPro).</p>
<p><strong>Λόγος:</strong> ${esc(reason)}</p>
<p><a href="${site}/admin">Άνοιγμα admin dashboard</a></p></div>`,
      });
      if (error) console.warn('[unapproved alert] email', error.message);
    }

    if (getAdminPushRecipient()) {
      await sendPushToBrand(getAdminPushRecipient()!, {
        title: '⚠️ Creator χωρίς έγκριση',
        body: `${name}: ${reason.slice(0, 120)}`,
        url: '/admin',
        tag: `admin-unapproved-${opts.influencerId}`,
      });
    }
  } catch (err) {
    console.warn('[unapproved alert]', err instanceof Error ? err.message : err);
  }
}
