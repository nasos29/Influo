/**
 * Weekly brand digest: newly approved influencers → brands.
 *
 * Delivery:
 *   BRAND_WEEKLY_DIGEST_ZOHO_ENABLED=1 → Zoho Campaigns (temp list → one campaign)
 *   else → Resend one-by-one (fallback)
 *
 * LIVE: BRAND_WEEKLY_DIGEST_ZOHO_LIVE=1 for real brand emails; otherwise test recipient only.
 * Quiet window: 10:00–19:00 Europe/Athens (skip unless dry_run / force_quiet_bypass).
 *
 * Query:
 *   ?dry_run=1 — eligible counts only (no send / no brands_notified_at)
 *   ?preview=1 — Resend HTML preview to ADMIN_EMAIL (legacy)
 *   ?force_quiet_bypass=1 — ops/test outside quiet window (still requires CRON_SECRET)
 *
 * Suggested server crontab (UTC; 08:15 ≈ 10:15 Athens in winter):
 *   15 8 * * 1 /opt/influo/cron-run.sh /api/cron/weekly-brand-influencer-digest
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { assertCronAuth, cronSupabaseAdmin } from '@/lib/cronRoute';
import {
  buildDigestHtml,
  getWeeklyDigestWindow,
  sendWeeklyBrandInfluencerDigest,
} from '@/lib/brandWeeklyInfluencerDigest';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const denied = assertCronAuth(req);
  if (denied) return denied;

  const supabaseAdmin = cronSupabaseAdmin();

  try {
    const preview = req.nextUrl.searchParams.get('preview') === '1';
    const dryRun =
      req.nextUrl.searchParams.get('dry_run') === '1' ||
      req.nextUrl.searchParams.get('dryRun') === '1';
    const forceQuietBypass =
      req.nextUrl.searchParams.get('force_quiet_bypass') === '1' ||
      req.nextUrl.searchParams.get('forceQuietBypass') === '1';
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

    const result = await sendWeeklyBrandInfluencerDigest(supabaseAdmin, window, {
      dryRun,
      forceQuietBypass,
    });

    console.log('[weekly-brand-influencer-digest]', {
      skipped: result.skipped,
      reason: result.reason,
      channel: result.channel,
      influencerCount: result.influencerCount,
      brandsEligible: result.brandsEligible,
      emailsSent: result.emailsSent,
      dryRun: result.dryRun,
      zohoOk: result.zoho?.ok,
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
