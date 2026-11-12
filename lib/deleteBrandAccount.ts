import { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { sendPushToBrand } from '@/lib/push';
import { isProtectedTestAccount } from '@/lib/protectedAccount';
import { resolveBrandIdForUser } from '@/lib/brandProfile';
import type { User } from '@supabase/supabase-js';
import { mailFromNoreply, mailReplyToSupport, mailSupportAddress } from '@/lib/mailIdentity';

export type DeleteBrandInitiator = 'admin' | 'self';

export interface DeleteBrandAccountOptions {
  initiator?: DeleteBrandInitiator;
  actorEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** When set (self-service), resolve brand via auth user. Otherwise use brandId. */
  authUser?: User | null;
}

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

async function notifyBrandDeleted(opts: {
  brandName: string;
  email: string;
  initiator: DeleteBrandInitiator;
}): Promise<void> {
  const name = opts.brandName || 'Επιχείρηση';
  const safeName = escapeHtml(name);
  const reason =
    opts.initiator === 'self'
      ? 'μετά από αίτημά σας'
      : 'από την ομάδα του Influo';

  if (opts.email) {
    await sendPushToBrand(opts.email, {
      title: 'Ο λογαριασμός διαγράφηκε',
      body: `Ο λογαριασμός επιχείρησης στο influo.gr (${name}) έχει διαγραφεί οριστικά.`,
      url: 'https://www.influo.gr',
      tag: 'brand-account-deleted',
    }).catch((e) => {
      console.warn('[deleteBrandAccount] brand push:', e);
    });
  }

  if (!process.env.RESEND_API_KEY || !opts.email) return;
  const support = mailSupportAddress();
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: mailFromNoreply(),
    to: [opts.email],
    replyTo: mailReplyToSupport(),
    subject: 'Ο λογαριασμός επιχείρησης στο Influo.gr διαγράφηκε οριστικά',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 560px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: #991b1b; font-size: 20px; font-weight: 700; margin: 0;">Ο λογαριασμός διαγράφηκε</h1>
        </div>
        <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin: 0 0 16px 0;">Γεια σας ${safeName},</p>
          <p style="margin: 0 0 16px 0; color: #4b5563;">
            Ο λογαριασμός επιχείρησης στο <strong>influo.gr</strong> έχει διαγραφεί οριστικά ${reason}.
          </p>
          <p style="margin: 0 0 16px 0; color: #4b5563;">
            Το προφίλ, οι καμπάνιες, οι συνομιλίες, οι προσφορές και όλα τα σχετικά δεδομένα έχουν αφαιρεθεί από την πλατφόρμα. Η ενέργεια δεν μπορεί να αναιρεθεί.
          </p>
          <p style="margin: 0 0 8px 0; color: #4b5563;">
            Αν πιστεύετε ότι πρόκειται για λάθος, επικοινωνήστε μαζί μας στο
            <a href="mailto:${escapeHtml(support)}" style="color: #2563eb;">${escapeHtml(support)}</a>.
          </p>
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af;">Η ομάδα του Influo<br/>${SITE_URL}</p>
          </div>
        </div>
      </div>
    `,
  });
}

async function notifyAdminBrandDeleted(opts: {
  brandName: string;
  email: string;
  brandId: string;
  initiator: DeleteBrandInitiator;
  actorEmail?: string | null;
}): Promise<void> {
  const name = opts.brandName || 'Επιχείρηση';
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(opts.email || '—');
  const how =
    opts.initiator === 'self'
      ? 'από την ίδια την επιχείρηση'
      : `από admin${opts.actorEmail ? ` (${escapeHtml(opts.actorEmail)})` : ''}`;

  const adminEmail = adminInbox();
  if (adminEmail) {
    await sendPushToBrand(adminEmail, {
      title: '🗑️ Διαγραφή επιχείρησης',
      body: `${name} διαγράφηκε ${how}`,
      url: '/admin',
      tag: `admin-brand-deleted-${opts.brandId.slice(0, 8)}`,
    }).catch(() => {});
  }

  if (!process.env.RESEND_API_KEY || !adminEmail) return;
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: mailFromNoreply(),
    to: [adminEmail],
    subject: `Διαγραφή: ${name} διαγράφηκε οριστικά`,
    html: `
      <div style="font-family: sans-serif; font-size: 14px; color: #1f2937;">
        <h1 style="color: #92400e; font-size: 18px; font-weight: 700; margin: 0 0 12px;">Οριστική διαγραφή επιχείρησης</h1>
        <p><strong>${safeName}</strong> (${safeEmail}) · id <code>${escapeHtml(opts.brandId)}</code></p>
        <p>Διαγράφηκε ${how}.</p>
      </div>
    `,
  });
}

export async function deleteBrandAccount(
  supabaseAdmin: SupabaseClient,
  brandIdOrNull: string | null,
  options: DeleteBrandAccountOptions = {}
): Promise<{ success: boolean; error?: string; brandId?: string }> {
  const initiator: DeleteBrandInitiator = options.initiator || 'admin';

  let brandId = brandIdOrNull ? String(brandIdOrNull).trim() : '';
  if (!brandId && options.authUser) {
    brandId = (await resolveBrandIdForUser(supabaseAdmin, options.authUser)) || '';
  }
  if (!brandId) {
    return { success: false, error: 'Brand not found' };
  }

  const { data: brandData, error: brandLoadError } = await supabaseAdmin
    .from('brands')
    .select('id, brand_name, contact_email')
    .eq('id', brandId)
    .maybeSingle();

  if (brandLoadError) {
    console.error('[deleteBrandAccount] load:', brandLoadError.message);
  }

  let authUserId: string | null = null;
  let authEmail: string | null = null;

  if (options.authUser?.id) {
    authUserId = options.authUser.id;
    authEmail = options.authUser.email || null;
  } else {
    const { data: authById } = await supabaseAdmin.auth.admin.getUserById(brandId);
    if (authById?.user) {
      authUserId = authById.user.id;
      authEmail = authById.user.email || null;
    } else if (brandData?.contact_email) {
      const { data: listed } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const match = listed?.users?.find(
        (u) => u.email?.toLowerCase() === String(brandData.contact_email).toLowerCase()
      );
      if (match) {
        authUserId = match.id;
        authEmail = match.email || null;
      }
    }
  }

  if (!brandData && !authUserId) {
    return { success: false, error: 'Brand not found' };
  }

  const brandName =
    String(brandData?.brand_name || '').trim() || 'Επιχείρηση';
  const email = String(brandData?.contact_email || authEmail || '')
    .trim()
    .toLowerCase();

  if (
    isProtectedTestAccount({
      brand_name: brandName,
      contact_email: email || null,
    })
  ) {
    return { success: false, error: 'protected_test_account' };
  }

  await notifyBrandDeleted({ brandName, email, initiator }).catch((e) => {
    console.warn('[deleteBrandAccount] brand notify:', e);
  });
  await notifyAdminBrandDeleted({
    brandName,
    email,
    brandId,
    initiator,
    actorEmail: options.actorEmail,
  }).catch((e) => {
    console.warn('[deleteBrandAccount] admin notify:', e);
  });

  // Soft-linked rows (no FK cascade on email / optional brand_id).
  if (email) {
    const emailDeletes: Array<{ table: string; column: string }> = [
      { table: 'proposals', column: 'brand_email' },
      { table: 'conversations', column: 'brand_email' },
      { table: 'influencer_reviews', column: 'brand_email' },
    ];
    for (const { table, column } of emailDeletes) {
      const { error } = await supabaseAdmin.from(table).delete().ilike(column, email);
      if (error) console.error(`[deleteBrandAccount] ${table}:`, error.message);
    }

    const { error: pushErr } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_type', 'brand')
      .ilike('user_identifier', email);
    if (pushErr) console.error('[deleteBrandAccount] push_subscriptions:', pushErr.message);

    const { error: ticketErr } = await supabaseAdmin
      .from('support_tickets')
      .delete()
      .eq('user_type', 'brand')
      .ilike('user_id', email);
    if (ticketErr) {
      // Some schemas store brand uuid in user_id — try that too below.
      console.warn('[deleteBrandAccount] support_tickets by email:', ticketErr.message);
    }
  }

  const { error: proposalsByIdErr } = await supabaseAdmin
    .from('proposals')
    .delete()
    .eq('brand_id', brandId);
  if (proposalsByIdErr) {
    console.error('[deleteBrandAccount] proposals by brand_id:', proposalsByIdErr.message);
  }

  const { error: ticketByIdErr } = await supabaseAdmin
    .from('support_tickets')
    .delete()
    .eq('user_type', 'brand')
    .eq('user_id', brandId);
  if (ticketByIdErr) {
    console.warn('[deleteBrandAccount] support_tickets by id:', ticketByIdErr.message);
  }

  const roleId = authUserId || brandId;
  const { error: rolesDeleteError } = await supabaseAdmin
    .from('user_roles')
    .delete()
    .eq('id', roleId);
  if (rolesDeleteError) {
    console.error('[deleteBrandAccount] user_roles:', rolesDeleteError.message);
  }

  const { error: brandDeleteError } = await supabaseAdmin
    .from('brands')
    .delete()
    .eq('id', brandId);
  if (brandDeleteError) {
    console.error('[deleteBrandAccount] brands:', brandDeleteError.message);
    return {
      success: false,
      error: brandDeleteError.message || 'Failed to delete brand',
    };
  }

  if (authUserId) {
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
    if (authDeleteError) {
      return {
        success: false,
        error: authDeleteError.message || 'Failed to delete auth user',
        brandId,
      };
    }
  }

  try {
    await supabaseAdmin.from('admin_audit_log').insert({
      action_type: 'delete_brand',
      admin_email: options.actorEmail || (initiator === 'self' ? 'self-service' : 'unknown'),
      target_type: 'brand',
      target_id: brandId,
      target_email: email || 'unknown',
      target_name: brandName,
      details: {
        initiator,
        brand_data: brandData,
        auth_email: authEmail,
        notified: true,
      },
      ip_address: options.ipAddress || 'unknown',
      user_agent: options.userAgent || 'unknown',
    });
  } catch (auditError) {
    console.error('[deleteBrandAccount] audit log:', auditError);
  }

  return { success: true, brandId };
}
