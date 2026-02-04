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

const ANNOUNCEMENT_EMAIL_SUBJECT = 'Υπάρχει μια νέα ανακοίνωση στο Influo';
const ANNOUNCEMENT_EMAIL_HTML = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 560px; margin: 0 auto;">
  <p style="margin: 0 0 16px 0;">Υπάρχει μια νέα ανακοίνωση στο Influo.</p>
  <p style="margin: 0 0 20px 0;">Συνδέσου στο dashboard σου για να τη δεις.</p>
  <p style="margin: 0;"><a href="${SITE_URL}/login?redirect=/dashboard" style="color: #2563eb; font-weight: 600;">Άνοιξε το Influo →</a></p>
</div>`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, target_type, target_influencer_id } = body;

    if (!title || !content || !target_type) {
      return NextResponse.json(
        { error: 'Title, content and target_type are required' },
        { status: 400 }
      );
    }
    if (target_type !== 'all' && target_type !== 'specific') {
      return NextResponse.json(
        { error: 'target_type must be "all" or "specific"' },
        { status: 400 }
      );
    }
    if (target_type === 'specific' && !target_influencer_id) {
      return NextResponse.json(
        { error: 'target_influencer_id required when target_type is specific' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('announcements')
      .insert({
        title,
        body: content,
        target_type,
        target_influencer_id: target_type === 'specific' ? target_influencer_id : null,
      })
      .select('id, title, created_at, target_type, target_influencer_id')
      .single();

    if (error) {
      console.error('[admin announcements]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Στείλε email σε όσους αφορά (με καθυστέρηση ανά email ώστε να μην φαίνεται σπαμ)
    if (!process.env.RESEND_API_KEY) {
      console.warn('[admin announcements] RESEND_API_KEY not set, skipping email notifications');
    } else {
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
      } else if (target_type === 'specific' && target_influencer_id) {
        // target_influencer_id από το admin UI μπορεί να είναι auth_user_id (UUID) ή influencers.id
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
        } else if (target_type === 'specific') {
          console.warn('[admin announcements] No contact_email for target_influencer_id', target_influencer_id);
        }
      }
      for (let i = 0; i < emails.length; i++) {
        try {
          await resend.emails.send({
            from: `Influo <${FROM_EMAIL}>`,
            to: [emails[i]],
            subject: ANNOUNCEMENT_EMAIL_SUBJECT,
            html: ANNOUNCEMENT_EMAIL_HTML,
          });
        } catch (sendErr) {
          console.error('[admin announcements] email send error for', emails[i], sendErr);
        }
        if (i < emails.length - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('[admin announcements]', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .select('id, title, body, created_at, target_type, target_influencer_id')
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
