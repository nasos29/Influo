import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import {
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
  const isVercelCron =
    req.headers.get('x-vercel-cron') === '1' ||
    (req.headers.get('user-agent')?.includes('vercel-cron') ?? false);

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
    const window = getWeeklyDigestWindow();
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
