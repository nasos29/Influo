import { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import {
  sendPushAdminInfluencerAccountDeleted,
  sendPushInfluencerAccountDeleted,
} from '@/lib/push';

export type DeleteInfluencerInitiator = 'admin' | 'self';

export interface DeleteInfluencerAccountOptions {
  initiator?: DeleteInfluencerInitiator;
  actorEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

const FROM_EMAIL = 'noreply@influo.gr';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.influo.gr';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function adminInbox(): string | null {
  const e = (process.env.ADMIN_EMAIL || '').trim();
  return e || null;
}

async function notifyInfluencerDeleted(opts: {
  influencerId: string;
  displayName: string;
  email: string;
  initiator: DeleteInfluencerInitiator;
}): Promise<void> {
  const name = opts.displayName || 'Influencer';
  const safeName = escapeHtml(name);
  const reason =
    opts.initiator === 'self'
      ? 'μετά από αίτημά σας'
      : 'από την ομάδα του Influo';

  // Push first — subscriptions still exist.
  await sendPushInfluencerAccountDeleted(opts.influencerId, name).catch((e) => {
    console.warn('[deleteInfluencerAccount] influencer push:', e);
  });

  if (!process.env.RESEND_API_KEY || !opts.email) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: `Influo <${FROM_EMAIL}>`,
    to: [opts.email],
    subject: 'Ο λογαριασμός σας στο Influo.gr διαγράφηκε οριστικά',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 560px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #991b1b; font-size: 20px; font-weight: 700; margin: 0;">Ο λογαριασμός διαγράφηκε</h1>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin: 0 0 16px 0;">Γεια σου ${safeName},</p>
          <p style="margin: 0 0 16px 0; color: #4b5563;">
            Ο λογαριασμός σας στο <strong>influo.gr</strong> έχει διαγραφεί οριστικά ${reason}.
          </p>
          <p style="margin: 0 0 16px 0; color: #4b5563;">
            Το προφίλ σας, οι συνομιλίες, οι προτάσεις συνεργασίας και όλα τα σχετικά δεδομένα έχουν αφαιρεθεί από την πλατφόρμα. Η ενέργεια δεν μπορεί να αναιρεθεί.
          </p>
          <p style="margin: 0 0 8px 0; color: #4b5563;">
            Αν πιστεύετε ότι πρόκειται για λάθος, επικοινωνήστε μαζί μας στο
            <a href="mailto:support@influo.gr" style="color: #2563eb;">support@influo.gr</a>.
          </p>
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo<br/>${SITE_URL}</p>
          </div>
        </div>
      </div>
    `,
  });
}

async function notifyAdminInfluencerDeleted(opts: {
  displayName: string;
  email: string;
  influencerId: string;
  initiator: DeleteInfluencerInitiator;
  actorEmail?: string | null;
}): Promise<void> {
  const name = opts.displayName || 'Influencer';
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(opts.email || '—');
  const how =
    opts.initiator === 'self'
      ? 'από τον ίδιο τον influencer'
      : `από admin${opts.actorEmail ? ` (${escapeHtml(opts.actorEmail)})` : ''}`;

  await sendPushAdminInfluencerAccountDeleted({
    displayName: name,
    email: opts.email || '',
    initiator: opts.initiator,
  }).catch((e) => {
    console.warn('[deleteInfluencerAccount] admin push:', e);
  });

  const adminTo = adminInbox();
  if (!process.env.RESEND_API_KEY || !adminTo) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: `Influo <${FROM_EMAIL}>`,
    to: [adminTo],
    subject: `Διαγραφή: ${name} διαγράφηκε οριστικά`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 560px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #92400e; font-size: 18px; font-weight: 700; margin: 0;">Οριστική διαγραφή influencer</h1>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin: 0 0 12px 0;">Ο influencer <strong>${safeName}</strong> διαγράφηκε οριστικά ${how}.</p>
          <p style="margin: 0 0 8px 0; color: #4b5563;"><strong>Email:</strong> ${safeEmail}</p>
          <p style="margin: 0 0 8px 0; color: #4b5563;"><strong>ID:</strong> ${escapeHtml(opts.influencerId)}</p>
          <p style="margin: 16px 0 0 0; font-size: 12px; color: #9ca3af;">Influo Admin · ${SITE_URL}/admin</p>
        </div>
      </div>
    `,
  });
}

/**
 * Permanently delete an influencer and related data (profile, auth, messages, proposals, etc.).
 * Sends email + push to the influencer and to admin before data is removed.
 */
export async function deleteInfluencerAccount(
  supabaseAdmin: SupabaseClient,
  userId: string,
  options: DeleteInfluencerAccountOptions = {}
): Promise<{ success: true } | { success: false; error: string }> {
  const trimmedId = userId.trim();
  if (!trimmedId) {
    return { success: false, error: 'User ID is required' };
  }

  const { data: influencerData } = await supabaseAdmin
    .from('influencers')
    .select('id, display_name, contact_email, created_at, verified, approved')
    .eq('id', trimmedId)
    .maybeSingle();

  const { data: authUserResponse } = await supabaseAdmin.auth.admin.getUserById(trimmedId);
  const authUserData = authUserResponse?.user;

  if (!influencerData && !authUserData) {
    return { success: false, error: 'Account not found' };
  }

  const displayName = String(influencerData?.display_name || 'Influencer').trim() || 'Influencer';
  const email = String(
    influencerData?.contact_email || authUserData?.email || ''
  )
    .trim()
    .toLowerCase();
  const initiator: DeleteInfluencerInitiator = options.initiator || 'admin';

  // Notify while push subscriptions + email still resolve.
  await notifyInfluencerDeleted({
    influencerId: trimmedId,
    displayName,
    email,
    initiator,
  }).catch((e) => {
    console.warn('[deleteInfluencerAccount] influencer notify:', e);
  });
  await notifyAdminInfluencerDeleted({
    displayName,
    email,
    influencerId: trimmedId,
    initiator,
    actorEmail: options.actorEmail,
  }).catch((e) => {
    console.warn('[deleteInfluencerAccount] admin notify:', e);
  });

  const relatedDeletes: Array<{ table: string; filter: Record<string, string> }> = [
    { table: 'proposals', filter: { influencer_id: trimmedId } },
    { table: 'push_subscriptions', filter: { user_type: 'influencer', user_identifier: trimmedId.toLowerCase() } },
    { table: 'support_tickets', filter: { user_type: 'influencer', user_id: trimmedId } },
    { table: 'announcement_reads', filter: { influencer_id: trimmedId } },
  ];

  for (const { table, filter } of relatedDeletes) {
    let query = supabaseAdmin.from(table).delete();
    for (const [key, value] of Object.entries(filter)) {
      query = query.eq(key, value);
    }
    const { error } = await query;
    if (error) {
      console.error(`[deleteInfluencerAccount] ${table}:`, error.message);
    }
  }

  const { error: rolesDeleteError } = await supabaseAdmin
    .from('user_roles')
    .delete()
    .eq('id', trimmedId);
  if (rolesDeleteError) {
    console.error('[deleteInfluencerAccount] user_roles:', rolesDeleteError.message);
  }

  const { error: influencerDeleteError } = await supabaseAdmin
    .from('influencers')
    .delete()
    .eq('id', trimmedId);
  if (influencerDeleteError) {
    console.error('[deleteInfluencerAccount] influencers:', influencerDeleteError.message);
  }

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(trimmedId);
  if (authDeleteError) {
    return {
      success: false,
      error: authDeleteError.message || 'Failed to delete auth user',
    };
  }

  try {
    await supabaseAdmin.from('admin_audit_log').insert({
      action_type: 'delete_user',
      admin_email: options.actorEmail || (options.initiator === 'self' ? 'self-service' : 'unknown'),
      target_type: 'influencer',
      target_id: trimmedId,
      target_email: email || 'unknown',
      target_name: displayName,
      details: {
        initiator,
        influencer_data: influencerData,
        auth_email: authUserData?.email || null,
        notified: true,
      },
      ip_address: options.ipAddress || 'unknown',
      user_agent: options.userAgent || 'unknown',
    });
  } catch (auditError) {
    console.error('[deleteInfluencerAccount] audit log:', auditError);
  }

  return { success: true };
}
