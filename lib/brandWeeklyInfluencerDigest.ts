import { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { emailNextSteps } from '@/lib/emailNextSteps';
import { formatDisplayDate } from '@/lib/formatDate';
import {
  athensHour,
  isWithinQuietSendWindow,
  QUIET_END_HOUR_ATHENS,
  QUIET_START_HOUR_ATHENS,
} from '@/lib/brandCampaignReminders';
import { zohoCampaignsCredentialsReady } from '@/lib/zohoCampaignsConfig';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://influo.gr';
const FROM_EMAIL = 'noreply@influo.gr';
const PLATFORM_NAME = 'Influo';

export interface WeeklyDigestWindow {
  start: string;
  end: string;
  startDate: Date;
  endDate: Date;
}

export interface WeeklyDigestResult {
  skipped: boolean;
  reason?: string;
  channel?: 'zoho' | 'resend';
  quietHours?: boolean;
  influencerCount: number;
  brandsTotal: number;
  brandsEligible: number;
  brandsOptedOut: number;
  emailsSent: number;
  pushSent: number;
  dryRun?: boolean;
  zoho?: {
    ok: boolean;
    campaignKey?: string;
    listKey?: string;
    subscribed?: number;
    localOptOutMarked?: number;
    testOnly?: boolean;
    syncErrors?: string[];
    error?: string;
  };
  errors?: string[];
}

export type InfluencerRow = {
  id: string | number;
  display_name: string | null;
  category: string | string[] | null;
  accounts: Array<{ platform?: string; followers?: string | number }> | null;
  approved_at: string | null;
  profile_slug?: string | null;
  avatar_url?: string | null;
};

type BrandRow = {
  id: string;
  brand_name: string | null;
  contact_email: string | null;
  announcements_email_opted_out?: boolean | null;
};

export type DigestSendOptions = {
  dryRun?: boolean;
  forceQuietBypass?: boolean;
  nowMs?: number;
  env?: NodeJS.ProcessEnv;
};

/** Zoho path when ON; otherwise Resend fallback. Default OFF. */
export function isBrandWeeklyDigestZohoEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return /^(1|true|yes)$/i.test(String(env.BRAND_WEEKLY_DIGEST_ZOHO_ENABLED || '').trim());
}

/** Live Zoho digest (real brand emails). Default OFF → test recipient only. */
export function isBrandWeeklyDigestZohoLive(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return /^(1|true|yes)$/i.test(String(env.BRAND_WEEKLY_DIGEST_ZOHO_LIVE || '').trim());
}

export function brandWeeklyDigestTestRecipient(
  env: NodeJS.ProcessEnv = process.env
): string {
  return (
    env.BRAND_WEEKLY_DIGEST_TEST_RECIPIENT ||
    env.BRAND_CAMPAIGN_REMINDERS_TEST_RECIPIENT ||
    env.ADMIN_EMAIL ||
    'nd.6@hotmail.com'
  )
    .trim()
    .toLowerCase();
}

export function getWeeklyDigestWindow(now = new Date()): WeeklyDigestWindow {
  const endDate = new Date(now);
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 7);
  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    startDate,
    endDate,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseFollowerString(str: string | number | null | undefined): number {
  if (str == null || str === '') return 0;
  const clean = String(str).toLowerCase().replace(/\s/g, '').replace(/,/g, '').trim();
  if (clean.includes('k')) return parseFloat(clean) * 1000;
  if (clean.includes('m')) return parseFloat(clean) * 1_000_000;
  const num = parseFloat(clean);
  return Number.isNaN(num) ? 0 : num;
}

function formatFollowers(accounts: InfluencerRow['accounts']): string {
  if (!Array.isArray(accounts) || accounts.length === 0) return '-';
  const byPlatform: Record<string, number> = {};
  accounts.forEach((acc) => {
    const plat = (acc.platform || '').toLowerCase();
    if (!plat) return;
    const n = parseFollowerString(acc.followers);
    if (n > 0) byPlatform[plat] = (byPlatform[plat] || 0) + n;
  });
  const parts = Object.entries(byPlatform).map(([platform, n]) => {
    if (n >= 1_000_000) return `${platform}: ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${platform}: ${(n / 1_000).toFixed(1)}k`;
    return `${platform}: ${n}`;
  });
  return parts.length ? parts.join(', ') : '-';
}

function formatCategory(category: InfluencerRow['category']): string {
  if (typeof category === 'string') return category || '-';
  if (Array.isArray(category)) return category.filter(Boolean).join(', ') || '-';
  return '-';
}

function formatWeekRange(window: WeeklyDigestWindow): string {
  const start = formatDisplayDate(window.startDate);
  const end = formatDisplayDate(window.endDate);
  return `${start} – ${end}`;
}

export function digestSubject(influencerCount: number): string {
  return influencerCount === 1
    ? 'Νέος influencer αυτή την εβδομάδα – Influo'
    : `${influencerCount} νέοι influencers αυτή την εβδομάδα – Influo`;
}

export function buildDigestHtml(
  brandName: string,
  influencers: InfluencerRow[],
  window: WeeklyDigestWindow,
  opts?: { zohoBulk?: boolean }
): string {
  const weekRange = formatWeekRange(window);
  const campaignsUrl = `${SITE_URL}/brand/dashboard?tab=campaigns`;
  const greeting = opts?.zohoBulk
    ? 'Γεια σας,'
    : `Γεια σας ${escapeHtml(brandName || 'Επιχείρηση')},`;
  const listItems = influencers
    .map((influencer) => {
      const name = escapeHtml(influencer.display_name || 'Influencer');
      const category = escapeHtml(formatCategory(influencer.category));
      const followers = escapeHtml(formatFollowers(influencer.accounts));
      const profileLink = influencer.profile_slug
        ? `${SITE_URL}/in/${influencer.profile_slug}`
        : `${SITE_URL}/influencer/${influencer.id}`;
      const avatar = (influencer.avatar_url || '').trim();
      const avatarHtml = avatar
        ? `<img src="${escapeHtml(avatar)}" alt="" width="56" height="56" style="width:56px;height:56px;border-radius:9999px;object-fit:cover;display:block;border:1px solid #e5e7eb;" />`
        : `<div style="width:56px;height:56px;border-radius:9999px;background:#e5e7eb;color:#6b7280;font-size:18px;font-weight:700;line-height:56px;text-align:center;">${name.charAt(0).toUpperCase()}</div>`;
      return `
  <li style="margin: 0 0 16px 0; padding: 0 0 16px 0; border-bottom: 1px solid #e5e7eb; list-style: none;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;">
      <tr>
        <td style="width:56px;vertical-align:top;padding-right:12px;">${avatarHtml}</td>
        <td style="vertical-align:top;">
          <p style="margin: 0 0 4px 0; font-size: 15px;"><strong>${name}</strong></p>
          <p style="margin: 0 0 4px 0; color: #4b5563;">Κατηγορία: ${category}</p>
          <p style="margin: 0 0 8px 0; color: #4b5563;">Ακόλουθοι: ${followers}</p>
          <a href="${profileLink}" style="color: #2563eb; font-weight: 600; text-decoration: none;">Δείτε το προφίλ →</a>
        </td>
      </tr>
    </table>
  </li>`;
    })
    .join('');

  const zohoUnsubNote = opts?.zohoBulk
    ? `<p style="margin: 20px 0 0 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
       Αν δεν επιθυμείτε πλέον emails καταλόγου από το Influo, χρησιμοποιήστε τον σύνδεσμο διαγραφής (unsubscribe) στο κάτω μέρος.
       Η διαγραφή μέσω Zoho ενημερώνει και το Influo.
     </p>`
    : '';

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 560px; margin: 0 auto;">
  <p style="margin: 0 0 16px 0;">${greeting}</p>
  <p style="margin: 0 0 16px 0;">Αυτή την εβδομάδα (${weekRange}) εγκρίθηκαν <strong>${influencers.length}</strong> νέα προφίλ influencers στον κατάλογο της Influo:</p>
  <ul style="margin: 0 0 20px 0; padding: 0;">${listItems}</ul>
  <p style="margin: 0 0 12px 0;">Μπορείτε να δείτε όλους τους influencers στο directory: <a href="${SITE_URL}/directory" style="color: #2563eb; font-weight: 600;">${SITE_URL}/directory</a></p>
  <p style="margin: 0 0 20px 0; padding: 14px 16px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; color: #1e3a8a;">
    <a href="${campaignsUrl}" style="color: #1d4ed8; font-weight: 700; text-decoration: none;">Ανέβασε τώρα την Καμπάνια της επιχείρησής σου εντελώς δωρεάν</a>, πάρε προτάσεις από εγκεκριμένους Influencers και δες τις πωλήσεις σου να αυξάνονται!
  </p>
  ${emailNextSteps("brand_weekly_digest")}
  <p style="margin: 0; font-size: 12px; color: #6b7280;">Με εκτίμηση,<br/>Η ομάδα ${PLATFORM_NAME}</p>
  ${zohoUnsubNote}
</div>`;
}

/** Influencers due for the digest (approved in window, not yet brands_notified). */
export async function fetchDigestInfluencers(
  supabaseAdmin: SupabaseClient,
  window: WeeklyDigestWindow
): Promise<InfluencerRow[]> {
  const { data, error } = await supabaseAdmin
    .from('influencers')
    .select('id, display_name, category, accounts, approved_at, profile_slug, avatar_url')
    .eq('approved', true)
    .is('brands_notified_at', null)
    .not('approved_at', 'is', null)
    .gte('approved_at', window.start)
    .lt('approved_at', window.end)
    .order('approved_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as InfluencerRow[];
}

/**
 * Influencers for Zoho content_url: approved in window (ignore brands_notified_at
 * so Zoho can re-fetch after we mark notified).
 */
export async function fetchDigestInfluencersForWindow(
  supabaseAdmin: SupabaseClient,
  window: Pick<WeeklyDigestWindow, 'start' | 'end'>
): Promise<InfluencerRow[]> {
  const { data, error } = await supabaseAdmin
    .from('influencers')
    .select('id, display_name, category, accounts, approved_at, profile_slug, avatar_url')
    .eq('approved', true)
    .not('approved_at', 'is', null)
    .gte('approved_at', window.start)
    .lt('approved_at', window.end)
    .order('approved_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as InfluencerRow[];
}

export async function fetchDigestBrandRecipients(supabaseAdmin: SupabaseClient): Promise<{
  eligible: Array<{ id: string; brand_name: string | null; email: string }>;
  optedOut: number;
  totalWithEmail: number;
}> {
  let { data: brands, error } = await supabaseAdmin
    .from('brands')
    .select('id, brand_name, contact_email, announcements_email_opted_out');

  if (error && /announcements_email_opted_out|PGRST204|42703/i.test(error.message || '')) {
    const retry = await supabaseAdmin.from('brands').select('id, brand_name, contact_email');
    if (retry.error) throw new Error(retry.error.message);
    brands = (retry.data || []).map((b) => ({ ...b, announcements_email_opted_out: false }));
    error = null;
  }
  if (error) throw new Error(error.message);

  const rows = (brands || []) as BrandRow[];
  let optedOut = 0;
  let totalWithEmail = 0;
  const eligible: Array<{ id: string; brand_name: string | null; email: string }> = [];

  for (const b of rows) {
    const email = (b.contact_email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) continue;
    totalWithEmail += 1;
    if (b.announcements_email_opted_out === true) {
      optedOut += 1;
      continue;
    }
    eligible.push({ id: b.id, brand_name: b.brand_name, email });
  }

  return { eligible, optedOut, totalWithEmail };
}

async function markInfluencersNotified(
  supabaseAdmin: SupabaseClient,
  rows: InfluencerRow[]
): Promise<void> {
  if (rows.length === 0) return;
  const now = new Date().toISOString();
  const ids = rows.map((r) => r.id);
  const { error: updateErr } = await supabaseAdmin
    .from('influencers')
    .update({ brands_notified_at: now })
    .in('id', ids);
  if (updateErr) {
    console.warn('[weekly-brand-influencer-digest] brands_notified_at update:', updateErr.message);
  }
}

async function sendDigestViaResend(
  supabaseAdmin: SupabaseClient,
  rows: InfluencerRow[],
  recipients: Array<{ id: string; brand_name: string | null; email: string }>,
  window: WeeklyDigestWindow
): Promise<Pick<WeeklyDigestResult, 'emailsSent' | 'pushSent' | 'errors'>> {
  if (!process.env.RESEND_API_KEY) {
    return {
      emailsSent: 0,
      pushSent: 0,
      errors: ['RESEND_API_KEY not configured'],
    };
  }

  const { sendPushToBrand } = await import('@/lib/push');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const subject = digestSubject(rows.length);
  let emailsSent = 0;
  let pushSent = 0;
  const errors: string[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const brand = recipients[i];
    const brandName = brand.brand_name || 'Επιχείρηση';
    const html = buildDigestHtml(brandName, rows, window);

    try {
      const { error } = await resend.emails.send({
        from: `${PLATFORM_NAME} <${FROM_EMAIL}>`,
        to: [brand.email],
        subject,
        html,
      });
      if (error) {
        errors.push(`${brand.email}: ${error.message}`);
      } else {
        emailsSent++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${brand.email}: ${msg}`);
    }

    try {
      const count = rows.length;
      const pushBody =
        count === 1
          ? `${rows[0].display_name || 'Influencer'} · ${formatCategory(rows[0].category)}`
          : `${count} νέα προφίλ στον κατάλογο`;
      const pushResult = await sendPushToBrand(brand.email, {
        title: count === 1 ? 'Νέος influencer αυτή την εβδομάδα' : `${count} νέοι influencers αυτή την εβδομάδα`,
        body: pushBody,
        url: `${SITE_URL}/directory`,
        tag: `weekly-new-influencers-${window.end.slice(0, 10)}`,
      });
      pushSent += pushResult.sent;
    } catch (pushErr) {
      console.warn('[weekly-brand-influencer-digest] push for', brand.email, pushErr);
    }

    if (i < recipients.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (emailsSent > 0) {
    await markInfluencersNotified(supabaseAdmin, rows);
  }

  return {
    emailsSent,
    pushSent,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export async function sendWeeklyBrandInfluencerDigest(
  supabaseAdmin: SupabaseClient,
  window: WeeklyDigestWindow = getWeeklyDigestWindow(),
  opts: DigestSendOptions = {}
): Promise<WeeklyDigestResult> {
  const env = opts.env || process.env;
  const nowMs = opts.nowMs ?? Date.now();
  const dryRun = Boolean(opts.dryRun);
  const zohoEnabled = isBrandWeeklyDigestZohoEnabled(env);
  const quietOk = isWithinQuietSendWindow(nowMs);
  const quietHours = !quietOk;

  const empty = (partial: Partial<WeeklyDigestResult>): WeeklyDigestResult => ({
    skipped: true,
    channel: zohoEnabled ? 'zoho' : 'resend',
    quietHours,
    influencerCount: 0,
    brandsTotal: 0,
    brandsEligible: 0,
    brandsOptedOut: 0,
    emailsSent: 0,
    pushSent: 0,
    dryRun: dryRun || undefined,
    ...partial,
  });

  const rows = await fetchDigestInfluencers(supabaseAdmin, window);
  if (rows.length === 0) {
    return empty({ reason: 'No newly approved influencers this week' });
  }

  const { eligible, optedOut, totalWithEmail } = await fetchDigestBrandRecipients(supabaseAdmin);
  if (eligible.length === 0) {
    return empty({
      skipped: true,
      reason: totalWithEmail === 0 ? 'No brands with contact_email' : 'All brands opted out',
      influencerCount: rows.length,
      brandsTotal: totalWithEmail,
      brandsEligible: 0,
      brandsOptedOut: optedOut,
    });
  }

  // Dry-run: counts only (works outside quiet window).
  if (dryRun) {
    return {
      skipped: false,
      reason: 'dry_run',
      channel: zohoEnabled ? 'zoho' : 'resend',
      quietHours,
      influencerCount: rows.length,
      brandsTotal: totalWithEmail,
      brandsEligible: eligible.length,
      brandsOptedOut: optedOut,
      emailsSent: 0,
      pushSent: 0,
      dryRun: true,
      zoho: zohoEnabled
        ? {
            ok: true,
            testOnly: !isBrandWeeklyDigestZohoLive(env),
            subscribed: isBrandWeeklyDigestZohoLive(env) ? eligible.length : 1,
            syncErrors: [],
          }
        : undefined,
    };
  }

  if (quietHours && !opts.forceQuietBypass) {
    return empty({
      reason: `quiet_hours_athens_${QUIET_START_HOUR_ATHENS}_${QUIET_END_HOUR_ATHENS}`,
      influencerCount: rows.length,
      brandsTotal: totalWithEmail,
      brandsEligible: eligible.length,
      brandsOptedOut: optedOut,
    });
  }

  // --- Zoho path ---
  if (zohoEnabled) {
    if (!zohoCampaignsCredentialsReady()) {
      return empty({
        reason: 'zoho_credentials_missing',
        influencerCount: rows.length,
        brandsTotal: totalWithEmail,
        brandsEligible: eligible.length,
        brandsOptedOut: optedOut,
        errors: [
          'Need ZOHO_CAMPAIGNS_CLIENT_ID/SECRET/REFRESH_TOKEN + LIST_KEY_CREATORS/BRANDS (+ TOPIC_ID recommended)',
        ],
      });
    }

    const live = isBrandWeeklyDigestZohoLive(env);
    const testTo = brandWeeklyDigestTestRecipient(env);
    const contacts = live
      ? eligible.map((b) => ({
          email: b.email,
          displayName: b.brand_name || undefined,
          brandId: b.id,
        }))
      : [{ email: testTo, displayName: 'Influo test' }];

    const { sendBrandWeeklyDigestViaZoho } = await import('@/lib/zohoBrandWeeklyDigest');
    const zoho = await sendBrandWeeklyDigestViaZoho({
      contacts,
      window,
      influencerCount: rows.length,
      admin: supabaseAdmin,
      siteUrl: SITE_URL.replace(/\/$/, ''),
    });

    const result: WeeklyDigestResult = {
      skipped: !zoho.ok,
      reason: zoho.ok ? undefined : zoho.error || 'zoho_send_failed',
      channel: 'zoho',
      quietHours,
      influencerCount: rows.length,
      brandsTotal: totalWithEmail,
      brandsEligible: eligible.length,
      brandsOptedOut: optedOut,
      emailsSent: zoho.ok ? (zoho.subscribed ?? 0) : 0,
      pushSent: 0,
      zoho: {
        ok: zoho.ok,
        campaignKey: zoho.campaignKey,
        listKey: zoho.listKey ? `${zoho.listKey.slice(0, 8)}…` : undefined,
        subscribed: zoho.subscribed,
        localOptOutMarked: zoho.localOptOutMarked,
        testOnly: !live,
        syncErrors: zoho.syncErrors,
        error: zoho.error,
      },
      errors: zoho.ok ? undefined : [zoho.error || 'zoho_send_failed'],
    };

    // Mark notified only on LIVE success (test must not consume the week).
    if (zoho.ok && live) {
      await markInfluencersNotified(supabaseAdmin, rows);

      // Push stays local (Zoho is email-only).
      const { sendPushToBrand } = await import('@/lib/push');
      let pushSent = 0;
      for (const brand of eligible) {
        try {
          const count = rows.length;
          const pushBody =
            count === 1
              ? `${rows[0].display_name || 'Influencer'} · ${formatCategory(rows[0].category)}`
              : `${count} νέα προφίλ στον κατάλογο`;
          const pushResult = await sendPushToBrand(brand.email, {
            title:
              count === 1
                ? 'Νέος influencer αυτή την εβδομάδα'
                : `${count} νέοι influencers αυτή την εβδομάδα`,
            body: pushBody,
            url: `${SITE_URL}/directory`,
            tag: `weekly-new-influencers-${window.end.slice(0, 10)}`,
          });
          pushSent += pushResult.sent;
        } catch (pushErr) {
          console.warn('[weekly-brand-influencer-digest] push for', brand.email, pushErr);
        }
      }
      result.pushSent = pushSent;
    }

    return result;
  }

  // --- Resend fallback ---
  if (!process.env.RESEND_API_KEY) {
    return empty({
      channel: 'resend',
      reason: 'RESEND_API_KEY not configured',
      influencerCount: rows.length,
      brandsTotal: totalWithEmail,
      brandsEligible: eligible.length,
      brandsOptedOut: optedOut,
    });
  }

  const resendResult = await sendDigestViaResend(supabaseAdmin, rows, eligible, window);
  return {
    skipped: false,
    channel: 'resend',
    quietHours,
    influencerCount: rows.length,
    brandsTotal: totalWithEmail,
    brandsEligible: eligible.length,
    brandsOptedOut: optedOut,
    emailsSent: resendResult.emailsSent,
    pushSent: resendResult.pushSent,
    errors: resendResult.errors,
  };
}

/** Exported for tests / ops diagnostics. */
export { athensHour, isWithinQuietSendWindow };
