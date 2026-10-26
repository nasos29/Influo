import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse, after } from 'next/server';
import { Resend } from 'resend';
import { sendPushBrandAnnouncement, sendPushInfluencerAnnouncement } from '@/lib/push';
import { rejectUnlessAdmin } from '@/lib/apiAuth';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://influo.gr';
const FROM_EMAIL = 'noreply@influo.gr';

const ANNOUNCEMENT_TARGET_TYPES = ['all', 'specific', 'all_brands', 'specific_brand'] as const;
type AnnouncementTargetType = (typeof ANNOUNCEMENT_TARGET_TYPES)[number];

const ANNOUNCEMENT_EMAIL_SUBJECT = 'Υπάρχει μια νέα ανακοίνωση στο Influo';

function announcementEmailHtml(dashboardPath: string) {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 560px; margin: 0 auto;">
  <p style="margin: 0 0 16px 0;">Υπάρχει μια νέα ανακοίνωση στο Influo.</p>
  <p style="margin: 0 0 20px 0;">Συνδέσου στο dashboard σου για να τη δεις.</p>
  <p style="margin: 0;"><a href="${SITE_URL}${dashboardPath}" style="color: #2563eb; font-weight: 600;">Άνοιξε το Influo →</a></p>
</div>`;
}

async function sendAnnouncementEmails(emails: string[], dashboardPath: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[admin announcements] RESEND_API_KEY not set, skipping email notifications');
    return;
  }
  const unique = Array.from(
    new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => e.length > 0))
  );
  const html = announcementEmailHtml(dashboardPath);
  const chunkSize = 50;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    await Promise.allSettled(
      chunk.map((email) =>
        resend.emails.send({
          from: `Influo <${FROM_EMAIL}>`,
          to: [email],
          subject: ANNOUNCEMENT_EMAIL_SUBJECT,
          html,
        })
      )
    );
  }
}

async function notifyInfluencerRecipients(
  title: string,
  target_type: 'all' | 'specific',
  target_influencer_id?: string | null
) {
  try {
    let emails: string[] = [];
    if (target_type === 'all') {
      const { data: infList } = await supabaseAdmin
        .from('influencers')
        .select('contact_email')
        .eq('approved', true)
        .not('contact_email', 'is', null);
      emails = (infList || [])
        .map((r: { contact_email: string | null }) => r.contact_email)
        .filter((e): e is string => !!e && e.trim().length > 0);
    } else if (target_influencer_id) {
      let infRow: { contact_email: string | null } | null = null;
      const byAuth = await supabaseAdmin
        .from('influencers')
        .select('contact_email')
        .eq('auth_user_id', target_influencer_id)
        .maybeSingle();
      if (byAuth.data) {
        infRow = byAuth.data;
      } else {
        const idNum = Number(target_influencer_id);
        if (!Number.isNaN(idNum)) {
          const byId = await supabaseAdmin
            .from('influencers')
            .select('contact_email')
            .eq('id', idNum)
            .maybeSingle();
          if (byId.data) infRow = byId.data;
        }
      }
      if (infRow?.contact_email?.trim()) {
        emails = [infRow.contact_email.trim()];
      } else {
        console.warn('[admin announcements] No contact_email for target_influencer_id', target_influencer_id);
      }
    }
    await sendAnnouncementEmails(emails, '/login?redirect=/dashboard');
  } catch (emailErr) {
    console.warn('[admin announcements] influencer email notify:', emailErr);
  }

  try {
    if (target_type === 'all') {
      const { data: idRows } = await supabaseAdmin
        .from('influencers')
        .select('id')
        .eq('approved', true);
      const pushJobs = (idRows || [])
        .filter((row) => row?.id != null)
        .map((row) =>
          sendPushInfluencerAnnouncement(String(row.id), title).catch((err) => {
            console.warn('[admin announcements] push failed for', row?.id, err);
            return { sent: 0, failed: 1 };
          })
        );
      await Promise.allSettled(pushJobs);
    } else if (target_influencer_id) {
      let infId: string | number | null = null;
      const byAuth = await supabaseAdmin
        .from('influencers')
        .select('id')
        .eq('auth_user_id', target_influencer_id)
        .maybeSingle();
      if (byAuth.data?.id != null) {
        infId = byAuth.data.id;
      } else {
        const idNum = Number(target_influencer_id);
        if (!Number.isNaN(idNum)) {
          const byId = await supabaseAdmin
            .from('influencers')
            .select('id')
            .eq('id', idNum)
            .maybeSingle();
          if (byId.data?.id != null) infId = byId.data.id;
        } else {
          const byStr = await supabaseAdmin
            .from('influencers')
            .select('id')
            .eq('id', target_influencer_id)
            .maybeSingle();
          if (byStr.data?.id != null) infId = byStr.data.id;
        }
      }
      if (infId != null) {
        await sendPushInfluencerAnnouncement(String(infId), title);
      }
    }
  } catch (pushErr) {
    console.warn('[admin announcements] influencer push notify:', pushErr);
  }
}

async function notifyBrandRecipients(
  title: string,
  target_type: 'all_brands' | 'specific_brand',
  target_brand_id?: string | null
) {
  try {
    let emails: string[] = [];
    if (target_type === 'all_brands') {
      const { data: brandList } = await supabaseAdmin
        .from('brands')
        .select('contact_email')
        .not('contact_email', 'is', null);
      emails = (brandList || [])
        .map((r: { contact_email: string | null }) => r.contact_email)
        .filter((e): e is string => !!e && e.trim().length > 0);
    } else if (target_brand_id) {
      const { data: brandRow } = await supabaseAdmin
        .from('brands')
        .select('contact_email')
        .eq('id', target_brand_id)
        .maybeSingle();
      if (brandRow?.contact_email?.trim()) {
        emails = [brandRow.contact_email.trim()];
      } else {
        console.warn('[admin announcements] No contact_email for target_brand_id', target_brand_id);
      }
    }
    await sendAnnouncementEmails(
      emails,
      `/brand/login?redirect=${encodeURIComponent('/brand/dashboard?tab=announcements')}`
    );

    const pushJobs = emails.map((email) =>
      sendPushBrandAnnouncement(email, title).catch((err) => {
        console.warn('[admin announcements] brand push failed for', email, err);
        return { sent: 0, failed: 1 };
      })
    );
    await Promise.allSettled(pushJobs);
  } catch (err) {
    console.warn('[admin announcements] brand notify:', err);
  }
}

function isAnnouncementTargetType(value: unknown): value is AnnouncementTargetType {
  return typeof value === 'string' && (ANNOUNCEMENT_TARGET_TYPES as readonly string[]).includes(value);
}

export async function POST(request: NextRequest) {
  try {
    const denied = await rejectUnlessAdmin(request);
    if (denied) return denied;

    const body = await request.json();
    const { title, content, target_type, target_influencer_id, target_brand_id } = body;

    if (!title || !content || !target_type) {
      return NextResponse.json(
        { error: 'Title, content and target_type are required' },
        { status: 400 }
      );
    }
    if (!isAnnouncementTargetType(target_type)) {
      return NextResponse.json(
        {
          error:
            'target_type must be one of: all, specific, all_brands, specific_brand',
        },
        { status: 400 }
      );
    }
    if (target_type === 'specific' && !target_influencer_id) {
      return NextResponse.json(
        { error: 'target_influencer_id required when target_type is specific' },
        { status: 400 }
      );
    }
    if (target_type === 'specific_brand' && !target_brand_id) {
      return NextResponse.json(
        { error: 'target_brand_id required when target_type is specific_brand' },
        { status: 400 }
      );
    }

    const insertRow = {
      title,
      body: content,
      target_type,
      target_influencer_id: target_type === 'specific' ? target_influencer_id : null,
      target_brand_id: target_type === 'specific_brand' ? target_brand_id : null,
    };

    const { data, error } = await supabaseAdmin
      .from('announcements')
      .insert(insertRow)
      .select('id, title, created_at, target_type, target_influencer_id, target_brand_id')
      .single();

    if (error) {
      console.error('[admin announcements]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    after(() => {
      if (target_type === 'all' || target_type === 'specific') {
        return notifyInfluencerRecipients(title, target_type, target_influencer_id);
      }
      return notifyBrandRecipients(title, target_type, target_brand_id);
    });

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[admin announcements]', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const denied = await rejectUnlessAdmin(request);
    if (denied) return denied;

    const { data, error } = await supabaseAdmin
      .from('announcements')
      .select('id, title, body, created_at, target_type, target_influencer_id, target_brand_id')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[admin announcements GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data || [] });
  } catch (err: any) {
    console.error('[admin announcements GET]', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
