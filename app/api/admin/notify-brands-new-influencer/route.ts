import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://influo.gr';
const FROM_EMAIL = 'noreply@influo.gr';
const PLATFORM_NAME = 'Influo';

function formatFollowers(followers: Record<string, number> | null | undefined): string {
  if (!followers || typeof followers !== 'object') return '-';
  const parts = Object.entries(followers)
    .filter(([, n]) => n != null && !Number.isNaN(Number(n)))
    .map(([platform, n]) => {
      const num = Number(n);
      if (num >= 1_000_000) return `${platform}: ${(num / 1_000_000).toFixed(1)}M`;
      if (num >= 1_000) return `${platform}: ${(num / 1_000).toFixed(1)}k`;
      return `${platform}: ${num}`;
    });
  return parts.length ? parts.join(', ') : '-';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { influencerId } = body;
    if (!influencerId) {
      return NextResponse.json(
        { error: 'influencerId is required' },
        { status: 400 }
      );
    }

    const { data: influencer, error: infError } = await supabaseAdmin
      .from('influencers')
      .select('id, display_name, category, followers, accounts')
      .eq('id', Number(influencerId))
      .maybeSingle();

    if (infError || !influencer) {
      console.error('[notify-brands-new-influencer] influencer fetch', infError);
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      );
    }

    let followersDisplay = '-';
    if (influencer.followers && typeof influencer.followers === 'object') {
      followersDisplay = formatFollowers(influencer.followers as Record<string, number>);
    } else if (Array.isArray(influencer.accounts) && influencer.accounts.length > 0) {
      const byPlatform: Record<string, number> = {};
      influencer.accounts.forEach((acc: { platform?: string; followers?: string | number }) => {
        const plat = (acc.platform || '').toLowerCase();
        if (!plat) return;
        const n = typeof acc.followers === 'string' ? parseInt(acc.followers, 10) : Number(acc.followers);
        if (!Number.isNaN(n)) byPlatform[plat] = (byPlatform[plat] || 0) + n;
      });
      followersDisplay = formatFollowers(byPlatform);
    }

    const influencerName = influencer.display_name || 'Influencer';
    const categoryDisplay = typeof influencer.category === 'string'
      ? influencer.category
      : Array.isArray(influencer.category)
        ? influencer.category.join(', ')
        : '-';
    const profileLink = `${SITE_URL}/influencer/${influencer.id}`;

    const { data: brands, error: brandsError } = await supabaseAdmin
      .from('brands')
      .select('id, brand_name, contact_email');

    if (brandsError) {
      console.error('[notify-brands-new-influencer] brands fetch', brandsError);
      return NextResponse.json({ error: brandsError.message }, { status: 500 });
    }

    const toSend = (brands || [])
      .filter((b: { contact_email?: string | null }) => (b.contact_email || '').trim().length > 0)
      .map((b: { id: string; brand_name: string | null; contact_email: string }) => ({
        ...b,
        _email: b.contact_email.trim(),
      }));

    if (!process.env.RESEND_API_KEY) {
      console.warn('[notify-brands-new-influencer] RESEND_API_KEY not set, skipping emails');
      return NextResponse.json({ 
        success: false, 
        sent: 0, 
        total: toSend.length, 
        resendApiKeyMissing: true,
        message: 'RESEND_API_KEY not configured'
      });
    }

    let sent = 0;
    const errors: string[] = [];
    for (let i = 0; i < toSend.length; i++) {
      const brand = toSend[i];
      const toEmail = brand._email;
      const brandName = brand.brand_name || 'Επιχείρηση';
      const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 560px; margin: 0 auto;">
  <p style="margin: 0 0 16px 0;">Γεια σας ${brandName},</p>
  <p style="margin: 0 0 16px 0;">Έχουμε ένα νέο influencer στον κατάλογό μας που μπορεί να ταιριάξει με την επιχείρησή σας:</p>
  <p style="margin: 0 0 8px 0;"><strong>Όνομα:</strong> ${influencerName}</p>
  <p style="margin: 0 0 8px 0;"><strong>Κατηγορία:</strong> ${categoryDisplay}</p>
  <p style="margin: 0 0 16px 0;"><strong>Αριθμός ακολούθων:</strong> ${followersDisplay}</p>
  <p style="margin: 0 0 16px 0;">Μπορείτε να δείτε το πλήρες προφίλ εδώ: <a href="${profileLink}" style="color: #2563eb; font-weight: 600;">${profileLink}</a></p>
  <p style="margin: 0 0 20px 0;">Μην χάσετε την ευκαιρία να ξεκινήσετε συνεργασία μαζί του σήμερα !</p>
  <p style="margin: 0; font-size: 12px; color: #6b7280;">Με εκτίμηση,<br/>Η ομάδα ${PLATFORM_NAME}</p>
</div>`;
      try {
        const { data, error } = await resend.emails.send({
          from: `${PLATFORM_NAME} <${FROM_EMAIL}>`,
          to: [toEmail],
          subject: `Νέος influencer στον κατάλογο – ${influencerName}`,
          html,
        });
        if (error) {
          console.error('[notify-brands-new-influencer] send error for', toEmail, error);
          errors.push(`${toEmail}: ${error.message}`);
        } else {
          sent++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[notify-brands-new-influencer] send error for', toEmail, err);
        errors.push(`${toEmail}: ${msg}`);
      }
      if (i < toSend.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    return NextResponse.json({ 
      success: errors.length === 0 || sent > 0, 
      sent, 
      total: toSend.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('[notify-brands-new-influencer]', err);
    return NextResponse.json(
      { error: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}
