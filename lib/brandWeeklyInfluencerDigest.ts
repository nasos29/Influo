import { SupabaseClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { sendPushToBrand } from '@/lib/push';

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
  influencerCount: number;
  brandsTotal: number;
  emailsSent: number;
  pushSent: number;
  errors?: string[];
}

type InfluencerRow = {
  id: string | number;
  display_name: string | null;
  category: string | string[] | null;
  accounts: Array<{ platform?: string; followers?: string | number }> | null;
  approved_at: string | null;
  profile_slug?: string | null;
};

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
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
  const start = window.startDate.toLocaleDateString('el-GR', opts);
  const end = window.endDate.toLocaleDateString('el-GR', opts);
  return `${start} – ${end}`;
}

function buildDigestHtml(
  brandName: string,
  influencers: InfluencerRow[],
  window: WeeklyDigestWindow
): string {
  const weekRange = formatWeekRange(window);
  const listItems = influencers
    .map((influencer) => {
      const name = influencer.display_name || 'Influencer';
      const category = formatCategory(influencer.category);
      const followers = formatFollowers(influencer.accounts);
      const profileLink = influencer.profile_slug
        ? `${SITE_URL}/in/${influencer.profile_slug}`
        : `${SITE_URL}/influencer/${influencer.id}`;
      return `
  <li style="margin: 0 0 16px 0; padding: 0 0 16px 0; border-bottom: 1px solid #e5e7eb; list-style: none;">
    <p style="margin: 0 0 4px 0; font-size: 15px;"><strong>${name}</strong></p>
    <p style="margin: 0 0 4px 0; color: #4b5563;">Κατηγορία: ${category}</p>
    <p style="margin: 0 0 8px 0; color: #4b5563;">Ακόλουθοι: ${followers}</p>
    <a href="${profileLink}" style="color: #2563eb; font-weight: 600; text-decoration: none;">Δείτε το προφίλ →</a>
  </li>`;
    })
    .join('');

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 560px; margin: 0 auto;">
  <p style="margin: 0 0 16px 0;">Γεια σας ${brandName},</p>
  <p style="margin: 0 0 16px 0;">Αυτή την εβδομάδα (${weekRange}) εγκρίθηκαν <strong>${influencers.length}</strong> νέα προφίλ influencers στον κατάλογο της Influo:</p>
  <ul style="margin: 0 0 20px 0; padding: 0;">${listItems}</ul>
  <p style="margin: 0 0 20px 0;">Μπορείτε να δείτε όλους τους influencers στο directory: <a href="${SITE_URL}/directory" style="color: #2563eb; font-weight: 600;">${SITE_URL}/directory</a></p>
  <p style="margin: 0; font-size: 12px; color: #6b7280;">Με εκτίμηση,<br/>Η ομάδα ${PLATFORM_NAME}</p>
</div>`;
}

export async function sendWeeklyBrandInfluencerDigest(
  supabaseAdmin: SupabaseClient,
  window: WeeklyDigestWindow = getWeeklyDigestWindow()
): Promise<WeeklyDigestResult> {
  const { data: influencers, error: infError } = await supabaseAdmin
    .from('influencers')
    .select('id, display_name, category, accounts, approved_at, profile_slug')
    .eq('approved', true)
    .is('brands_notified_at', null)
    .not('approved_at', 'is', null)
    .gte('approved_at', window.start)
    .lt('approved_at', window.end)
    .order('approved_at', { ascending: true });

  if (infError) {
    throw new Error(infError.message);
  }

  const rows = (influencers || []) as InfluencerRow[];
  if (rows.length === 0) {
    return {
      skipped: true,
      reason: 'No newly approved influencers this week',
      influencerCount: 0,
      brandsTotal: 0,
      emailsSent: 0,
      pushSent: 0,
    };
  }

  const { data: brands, error: brandsError } = await supabaseAdmin
    .from('brands')
    .select('id, brand_name, contact_email');

  if (brandsError) {
    throw new Error(brandsError.message);
  }

  const toSend = (brands || [])
    .filter((b: { contact_email?: string | null }) => (b.contact_email || '').trim().length > 0)
    .map((b: { id: string; brand_name: string | null; contact_email: string }) => ({
      ...b,
      _email: b.contact_email.trim(),
    }));

  if (toSend.length === 0) {
    return {
      skipped: true,
      reason: 'No brands with contact_email',
      influencerCount: rows.length,
      brandsTotal: 0,
      emailsSent: 0,
      pushSent: 0,
    };
  }

  if (!process.env.RESEND_API_KEY) {
    return {
      skipped: true,
      reason: 'RESEND_API_KEY not configured',
      influencerCount: rows.length,
      brandsTotal: toSend.length,
      emailsSent: 0,
      pushSent: 0,
    };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const count = rows.length;
  const subject =
    count === 1
      ? 'Νέος influencer αυτή την εβδομάδα – Influo'
      : `${count} νέοι influencers αυτή την εβδομάδα – Influo`;

  let emailsSent = 0;
  let pushSent = 0;
  const errors: string[] = [];

  for (let i = 0; i < toSend.length; i++) {
    const brand = toSend[i];
    const brandName = brand.brand_name || 'Επιχείρηση';
    const html = buildDigestHtml(brandName, rows, window);

    try {
      const { error } = await resend.emails.send({
        from: `${PLATFORM_NAME} <${FROM_EMAIL}>`,
        to: [brand._email],
        subject,
        html,
      });
      if (error) {
        errors.push(`${brand._email}: ${error.message}`);
      } else {
        emailsSent++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${brand._email}: ${msg}`);
    }

    try {
      const pushBody =
        count === 1
          ? `${rows[0].display_name || 'Influencer'} · ${formatCategory(rows[0].category)}`
          : `${count} νέα προφίλ στον κατάλογο`;
      const pushResult = await sendPushToBrand(brand._email, {
        title: count === 1 ? 'Νέος influencer αυτή την εβδομάδα' : `${count} νέοι influencers αυτή την εβδομάδα`,
        body: pushBody,
        url: `${SITE_URL}/directory`,
        tag: `weekly-new-influencers-${window.end.slice(0, 10)}`,
      });
      pushSent += pushResult.sent;
    } catch (pushErr) {
      console.warn('[weekly-brand-influencer-digest] push for', brand._email, pushErr);
    }

    if (i < toSend.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (emailsSent > 0) {
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

  return {
    skipped: false,
    influencerCount: rows.length,
    brandsTotal: toSend.length,
    emailsSent,
    pushSent,
    errors: errors.length > 0 ? errors : undefined,
  };
}
