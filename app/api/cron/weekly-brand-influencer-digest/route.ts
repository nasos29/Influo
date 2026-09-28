import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import {
  buildDigestHtml,
  getWeeklyDigestWindow,
  sendWeeklyBrandInfluencerDigest,
} from '@/lib/brandWeeklyInfluencerDigest';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function isAuthorizedCron(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = Boolean(
    req.headers.get('x-vercel-cron') === '1' ||
      req.headers.get('user-agent')?.includes('vercel-cron')
  );

  if (!cronSecret) {
    return isVercelCron;
  }

  const authHeader = req.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}` || isVercelCron;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const preview = req.nextUrl.searchParams.get('preview') === '1';
    const window = getWeeklyDigestWindow();

    if (preview) {
      const admin = process.env.ADMIN_EMAIL || 'nd.6@hotmail.com';
      if (!process.env.RESEND_API_KEY) {
        return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
      }

      let { data: rows, error } = await supabaseAdmin
        .from('influencers')
        .select('id, display_name, category, accounts, approved_at, profile_slug, avatar_url')
        .eq('approved', true)
        .not('avatar_url', 'is', null)
        .order('approved_at', { ascending: false })
        .limit(5);
      if (error) throw new Error(error.message);
      if (!rows?.length) {
        const fb = await supabaseAdmin
          .from('influencers')
          .select('id, display_name, category, accounts, approved_at, profile_slug, avatar_url')
          .eq('approved', true)
          .order('approved_at', { ascending: false })
          .limit(5);
        if (fb.error) throw new Error(fb.error.message);
        rows = fb.data || [];
      }
      if (!rows.length) {
        return NextResponse.json({ error: 'No influencers for preview' }, { status: 404 });
      }

      const html = buildDigestHtml('Admin (preview)', rows as any, window);
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { data: sent, error: sendErr } = await resend.emails.send({
        from: 'Influo <noreply@influo.gr>',
        to: [admin],
        subject: '[PREVIEW] Νέοι influencers αυτή την εβδομάδα – Influo',
        html,
      });
      if (sendErr) {
        return NextResponse.json({ error: sendErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        preview: true,
        to: admin,
        id: sent?.id,
        influencers: rows.map((r) => r.display_name),
      });
    }

    const result = await sendWeeklyBrandInfluencerDigest(supabaseAdmin, window);

    console.log('[weekly-brand-influencer-digest]', {
      skipped: result.skipped,
      reason: result.reason,
      influencerCount: result.influencerCount,
      emailsSent: result.emailsSent,
      brandsTotal: result.brandsTotal,
      window,
    });

    return NextResponse.json({
      success: true,
      window,
      ...result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[weekly-brand-influencer-digest]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
