/**
 * Daily: detect influencers who newly entered homepage Top 10 → email + push.
 * First run only bootstraps the snapshot (no emails to current Top 10).
 *
 * Preview (admin): GET ?preview=1&influencerId=<uuid> sends sample email to ADMIN_EMAIL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import {
  buildTop10CongratsHtml,
  runTop10Congrats,
} from '@/lib/top10Congrats';
import { publicProfilePath } from '@/lib/profileSlug';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://influo.gr').replace(
  /\/$/,
  ''
);

function isAuthorizedCron(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = Boolean(
    req.headers.get('x-vercel-cron') === '1' ||
      req.headers.get('user-agent')?.includes('vercel-cron')
  );
  if (!cronSecret) return isVercelCron;
  const authHeader = req.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}` || isVercelCron;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (req.nextUrl.searchParams.get('preview') === '1') {
      const admin = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com';
      if (!process.env.RESEND_API_KEY) {
        return NextResponse.json(
          { error: 'RESEND_API_KEY not configured' },
          { status: 500 }
        );
      }

      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const influencerId = (req.nextUrl.searchParams.get('influencerId') || '').trim();
      let name = 'Maria';
      let path = '/directory';
      if (influencerId) {
        const { data } = await sb
          .from('influencers')
          .select('display_name, profile_slug, id')
          .eq('id', influencerId)
          .maybeSingle();
        if (data) {
          name = (data.display_name || name).trim();
          path = publicProfilePath(data.profile_slug, data.id);
        }
      }

      const html = buildTop10CongratsHtml(name, `${SITE_URL}${path}`);
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { data: sent, error: sendErr } = await resend.emails.send({
        from: 'Influo <noreply@influo.gr>',
        to: [admin],
        subject: '[PREVIEW] Συγχαρητήρια! Μπήκες στο Top 10 του Influo 🏆',
        html,
      });
      if (sendErr) {
        return NextResponse.json({ error: sendErr.message }, { status: 500 });
      }
      return NextResponse.json({
        preview: true,
        to: admin,
        emailId: sent?.id ?? null,
      });
    }

    const result = await runTop10Congrats();
    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    console.error('[cron top10-congrats]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
