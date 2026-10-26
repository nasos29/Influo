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

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const BODY_PREVIEW_MAX = 280;

function parsePositiveInt(raw: string | null, fallback: number): number {
  const n = Number.parseInt(String(raw || ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function escapeIlike(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, ' ');
}

function truncateBody(body: string | null | undefined): string {
  const t = String(body || '');
  if (t.length <= BODY_PREVIEW_MAX) return t;
  return `${t.slice(0, BODY_PREVIEW_MAX - 1)}…`;
}

function dayStartIso(dateYmd: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return null;
  return `${dateYmd}T00:00:00.000Z`;
}

function dayEndIso(dateYmd: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return null;
  return `${dateYmd}T23:59:59.999Z`;
}

export async function GET(request: NextRequest) {
  try {
    const denied = await rejectUnlessAdmin(request);
    if (denied) return denied;

    const url = new URL(request.url);
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      parsePositiveInt(url.searchParams.get('pageSize'), DEFAULT_PAGE_SIZE)
    );
    const q = (url.searchParams.get('q') || '').trim();
    const targetTypeRaw = (url.searchParams.get('target_type') || '').trim();
    const targetType =
      targetTypeRaw && isAnnouncementTargetType(targetTypeRaw) ? targetTypeRaw : '';
    const fromRaw = (url.searchParams.get('from') || '').trim();
    const toRaw = (url.searchParams.get('to') || '').trim();
    const fromIso = fromRaw ? dayStartIso(fromRaw) : null;
    const toIso = toRaw ? dayEndIso(toRaw) : null;

    let listQuery = supabaseAdmin
      .from('announcements')
      .select(
        'id, title, body, created_at, target_type, target_influencer_id, target_brand_id',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (targetType) {
      listQuery = listQuery.eq('target_type', targetType);
    }
    if (fromIso) {
      listQuery = listQuery.gte('created_at', fromIso);
    }
    if (toIso) {
      listQuery = listQuery.lte('created_at', toIso);
    }
    if (q) {
      const pattern = `%${escapeIlike(q)}%`;
      listQuery = listQuery.or(`title.ilike.${pattern},body.ilike.${pattern}`);
    }

    const { data: announcements, error, count } = await listQuery;

    if (error) {
      console.error('[admin announcements GET]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = announcements || [];
    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

    if (rows.length === 0) {
      return NextResponse.json({
        data: [],
        page,
        pageSize,
        total,
        totalPages,
      });
    }

    const needsInfluencerRecipients = rows.some(
      (a) => a.target_type === 'all' || a.target_type === 'specific'
    );
    const needsBrandRecipients = rows.some(
      (a) => a.target_type === 'all_brands' || a.target_type === 'specific_brand'
    );

    const [approvedInfluencerCountRes, brandTotalCountRes] = await Promise.all([
      needsInfluencerRecipients
        ? supabaseAdmin
            .from('influencers')
            .select('id', { count: 'exact', head: true })
            .eq('approved', true)
        : Promise.resolve({ count: 0 }),
      needsBrandRecipients
        ? supabaseAdmin.from('brands').select('id', { count: 'exact', head: true })
        : Promise.resolve({ count: 0 }),
    ]);

    const recipientAll = approvedInfluencerCountRes.count ?? 0;
    const recipientAllBrands = brandTotalCountRes.count ?? 0;

    const influencerAnnIds = rows
      .filter((a) => a.target_type === 'all' || a.target_type === 'specific')
      .map((a) => a.id);
    const brandAnnIds = rows
      .filter((a) => a.target_type === 'all_brands' || a.target_type === 'specific_brand')
      .map((a) => a.id);

    const [infReadsRes, brandReadsRes] = await Promise.all([
      influencerAnnIds.length > 0
        ? supabaseAdmin
            .from('announcement_reads')
            .select('announcement_id, influencer_id, read_at')
            .in('announcement_id', influencerAnnIds)
        : Promise.resolve({
            data: [] as Array<{ announcement_id: string; influencer_id: string; read_at: string }>,
            error: null,
          }),
      brandAnnIds.length > 0
        ? supabaseAdmin
            .from('announcement_brand_reads')
            .select('announcement_id, brand_id, read_at')
            .in('announcement_id', brandAnnIds)
        : Promise.resolve({
            data: [] as Array<{ announcement_id: string; brand_id: string; read_at: string }>,
            error: null,
          }),
    ]);

    if (infReadsRes.error) {
      console.error('[admin announcements GET reads]', infReadsRes.error);
      return NextResponse.json({ error: infReadsRes.error.message }, { status: 500 });
    }
    if (brandReadsRes.error) {
      console.error('[admin announcements GET brand reads]', brandReadsRes.error);
      return NextResponse.json({ error: brandReadsRes.error.message }, { status: 500 });
    }

    const infReads = infReadsRes.data || [];
    const brandReads = brandReadsRes.data || [];

    const authIds = Array.from(
      new Set(infReads.map((r) => String(r.influencer_id)).filter(Boolean))
    );
    const approvedAuthIds = new Set<string>();
    if (authIds.length > 0) {
      const { data: infRows } = await supabaseAdmin
        .from('influencers')
        .select('auth_user_id')
        .eq('approved', true)
        .in('auth_user_id', authIds);
      for (const inf of infRows || []) {
        const key = String(inf.auth_user_id || '');
        if (key) approvedAuthIds.add(key);
      }
    }

    const infReadsByAnn = new Map<string, Array<{ influencer_id: string; read_at: string }>>();
    for (const r of infReads) {
      const aid = String(r.announcement_id);
      const list = infReadsByAnn.get(aid) || [];
      list.push({ influencer_id: String(r.influencer_id), read_at: r.read_at });
      infReadsByAnn.set(aid, list);
    }

    const brandReadsByAnn = new Map<string, Array<{ brand_id: string; read_at: string }>>();
    for (const r of brandReads) {
      const aid = String(r.announcement_id);
      const list = brandReadsByAnn.get(aid) || [];
      list.push({ brand_id: String(r.brand_id), read_at: r.read_at });
      brandReadsByAnn.set(aid, list);
    }

    // List payload: receipts for this page only — counts + specific read_at (no full reader names).
    const enriched = rows.map((a) => {
      let recipient_count = 0;
      let read_count = 0;
      let read_at: string | null = null;

      if (a.target_type === 'specific') {
        recipient_count = 1;
        const target = a.target_influencer_id ? String(a.target_influencer_id) : '';
        const match = (infReadsByAnn.get(String(a.id)) || []).find(
          (r) => r.influencer_id === target
        );
        if (match) {
          read_at = match.read_at;
          read_count = 1;
        }
      } else if (a.target_type === 'specific_brand') {
        recipient_count = 1;
        const target = a.target_brand_id ? String(a.target_brand_id) : '';
        const match = (brandReadsByAnn.get(String(a.id)) || []).find(
          (r) => r.brand_id === target
        );
        if (match) {
          read_at = match.read_at;
          read_count = 1;
        }
      } else if (a.target_type === 'all') {
        recipient_count = recipientAll;
        read_count = (infReadsByAnn.get(String(a.id)) || []).filter((r) =>
          approvedAuthIds.has(r.influencer_id)
        ).length;
      } else if (a.target_type === 'all_brands') {
        recipient_count = recipientAllBrands;
        read_count = (brandReadsByAnn.get(String(a.id)) || []).length;
      }

      return {
        id: a.id,
        title: a.title,
        body: truncateBody(a.body),
        created_at: a.created_at,
        target_type: a.target_type,
        target_influencer_id: a.target_influencer_id,
        target_brand_id: a.target_brand_id,
        read_count,
        recipient_count,
        read_at,
      };
    });

    return NextResponse.json({
      data: enriched,
      page,
      pageSize,
      total,
      totalPages,
    });
  } catch (err: any) {
    console.error('[admin announcements GET]', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
