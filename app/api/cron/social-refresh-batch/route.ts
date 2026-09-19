/**
 * Oracle 15-day social refresh worker API.
 * Scraping happens on the VM against localhost AuditPro — this route only
 * lists influencers, persists stats, unapproves profile errors, and stores logs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { doRefreshSocialStats, type InstagramOverrides, type TikTokOverrides, type YouTubeOverrides } from '@/lib/refreshSocialStats';
import {
  appendSocialRefreshLog,
  createSocialRefreshRun,
  finishSocialRefreshRun,
  isSessionDeadError,
  purgeOldSocialRefreshLogs,
  socialAccountsFromRow,
} from '@/lib/socialRefreshLogs';

export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function assertCronAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 401 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

type ScrapedAccount = {
  platform?: string;
  username?: string;
  ok?: boolean;
  followers?: string;
  engagement_rate?: string;
  avg_likes?: string;
  error?: string;
};

async function listAllInfluencersWithSocials() {
  const pageSize = 1000;
  const influencers: {
    id: string;
    display_name: string;
    approved: boolean;
    accounts: { platform: string; username: string }[];
  }[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from('influencers')
      .select('id, display_name, approved, accounts')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const row of rows) {
      const accounts = socialAccountsFromRow(row.accounts);
      if (!accounts.length) continue;
      influencers.push({
        id: String(row.id),
        display_name: row.display_name || String(row.id),
        approved: !!row.approved,
        accounts,
      });
    }
    if (rows.length < pageSize) break;
  }

  return influencers;
}

async function incrementRunCounters(
  runId: string,
  field: 'influencers_ok' | 'influencers_unapproved'
) {
  const { data, error } = await supabaseAdmin
    .from('social_refresh_runs')
    .select(field)
    .eq('id', runId)
    .single();
  if (error || !data) return;
  const current = Number((data as Record<string, unknown>)[field] ?? 0);
  await supabaseAdmin
    .from('social_refresh_runs')
    .update({ [field]: current + 1 })
    .eq('id', runId);
}

export async function GET(request: NextRequest) {
  const denied = assertCronAuth(request);
  if (denied) return denied;

  try {
    const influencers = await listAllInfluencersWithSocials();
    return NextResponse.json({
      influencers,
      count: influencers.length,
      auditpr: 'oracle-localhost',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const denied = assertCronAuth(request);
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    if (action === 'start') {
      const purged = await purgeOldSocialRefreshLogs(supabaseAdmin);
      const influencers = await listAllInfluencersWithSocials();
      const run = await createSocialRefreshRun(supabaseAdmin, influencers.length);
      await appendSocialRefreshLog(supabaseAdmin, {
        run_id: run.id,
        event: 'run_started',
        message: `Oracle batch started for ${influencers.length} influencers. Purged ${purged} old run(s) (>45 days).`,
      });
      return NextResponse.json({ run, influencers, purged });
    }

    if (action === 'log') {
      const runId = String(body?.run_id || '').trim();
      if (!runId) return NextResponse.json({ error: 'run_id required' }, { status: 400 });
      await appendSocialRefreshLog(supabaseAdmin, {
        run_id: runId,
        level: body?.level === 'error' || body?.level === 'warn' ? body.level : 'info',
        influencer_id: body?.influencer_id ? String(body.influencer_id) : null,
        influencer_name: body?.influencer_name ? String(body.influencer_name) : null,
        platform: body?.platform ? String(body.platform) : null,
        username: body?.username ? String(body.username) : null,
        event: String(body?.event || 'note'),
        message: String(body?.message || ''),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'abort') {
      const runId = String(body?.run_id || '').trim();
      if (!runId) return NextResponse.json({ error: 'run_id required' }, { status: 400 });
      const message = String(body?.message || 'Instagram/TikTok session stopped working. Batch aborted.');
      await appendSocialRefreshLog(supabaseAdmin, {
        run_id: runId,
        level: 'error',
        platform: body?.platform ? String(body.platform) : null,
        username: body?.username ? String(body.username) : null,
        influencer_id: body?.influencer_id ? String(body.influencer_id) : null,
        influencer_name: body?.influencer_name ? String(body.influencer_name) : null,
        event: 'session_dead',
        message,
      });
      await finishSocialRefreshRun(supabaseAdmin, runId, {
        status: 'aborted',
        message,
      });
      return NextResponse.json({ ok: true, aborted: true });
    }

    if (action === 'finish') {
      const runId = String(body?.run_id || '').trim();
      if (!runId) return NextResponse.json({ error: 'run_id required' }, { status: 400 });
      await appendSocialRefreshLog(supabaseAdmin, {
        run_id: runId,
        event: 'run_finished',
        message: String(body?.message || 'Oracle batch finished.'),
      });
      await finishSocialRefreshRun(supabaseAdmin, runId, {
        status: 'completed',
        influencers_ok: Number(body?.influencers_ok ?? 0),
        influencers_unapproved: Number(body?.influencers_unapproved ?? 0),
        message: String(body?.message || 'Completed'),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'apply') {
      const runId = String(body?.run_id || '').trim();
      const influencerId = String(body?.influencer_id || '').trim();
      const influencerName = String(body?.influencer_name || influencerId);
      const accounts = (Array.isArray(body?.accounts) ? body.accounts : []) as ScrapedAccount[];
      if (!runId || !influencerId) {
        return NextResponse.json({ error: 'run_id and influencer_id required' }, { status: 400 });
      }

      const sessionErrors = accounts
        .filter((a) => !a.ok && isSessionDeadError(String(a.error || '')))
        .map((a) => `${a.platform} @${a.username}: ${a.error}`);
      if (sessionErrors.length) {
        const message = `Session died while scraping ${influencerName}: ${sessionErrors.join(' | ')}`;
        await appendSocialRefreshLog(supabaseAdmin, {
          run_id: runId,
          level: 'error',
          influencer_id: influencerId,
          influencer_name: influencerName,
          event: 'session_dead',
          message,
        });
        await finishSocialRefreshRun(supabaseAdmin, runId, {
          status: 'aborted',
          message,
        });
        return NextResponse.json({ ok: false, aborted: true, session_dead: true, message });
      }

      const profileErrors = accounts.filter((a) => !a.ok);
      if (profileErrors.length) {
        const { error: unapproveErr } = await supabaseAdmin
          .from('influencers')
          .update({ approved: false })
          .eq('id', influencerId);
        const detail = profileErrors
          .map((a) => `${a.platform} @${a.username}: ${a.error || 'error'}`)
          .join(' | ');
        await appendSocialRefreshLog(supabaseAdmin, {
          run_id: runId,
          level: 'error',
          influencer_id: influencerId,
          influencer_name: influencerName,
          event: 'unapproved',
          message: unapproveErr
            ? `Failed to unapprove ${influencerName}: ${unapproveErr.message}. Profile errors: ${detail}`
            : `Unapproved ${influencerName} because at least one social profile failed. ${detail}`,
        });
        for (const acc of profileErrors) {
          await appendSocialRefreshLog(supabaseAdmin, {
            run_id: runId,
            level: 'error',
            influencer_id: influencerId,
            influencer_name: influencerName,
            platform: acc.platform || null,
            username: acc.username || null,
            event: 'profile_error',
            message: String(acc.error || 'Unknown profile error'),
          });
        }
        await incrementRunCounters(runId, 'influencers_unapproved');
        return NextResponse.json({
          ok: false,
          unapproved: !unapproveErr,
          errors: profileErrors.map((a) => a.error),
        });
      }

      const instagramOverrides: InstagramOverrides = {};
      const tiktokOverrides: TikTokOverrides = {};
      const youtubeOverrides: YouTubeOverrides = {};
      for (const acc of accounts) {
        const platform = String(acc.platform || '').toLowerCase();
        const username = String(acc.username || '').replace(/^@+/, '').trim();
        if (!username || !acc.ok) continue;
        const metrics = {
          followers: String(acc.followers || ''),
          engagement_rate: String(acc.engagement_rate || 'N/A'),
          avg_likes: String(acc.avg_likes || '0'),
        };
        if (platform === 'instagram') instagramOverrides[username] = metrics;
        else if (platform === 'tiktok') tiktokOverrides[username] = metrics;
        else if (platform === 'youtube') youtubeOverrides[username] = metrics;
      }

      const result = await doRefreshSocialStats(supabaseAdmin, {
        influencerId,
        auditprBaseUrl: '',
        overridesOnly: true,
        instagramOverrides,
        tiktokOverrides,
        youtubeOverrides,
      });
      const persistErrors = (result.results?.[0]?.errors || []).filter((e) => !/^Audit:/i.test(e));
      if (persistErrors.length) {
        await appendSocialRefreshLog(supabaseAdmin, {
          run_id: runId,
          level: 'warn',
          influencer_id: influencerId,
          influencer_name: influencerName,
          event: 'persist_warning',
          message: persistErrors.join(' | '),
        });
      }
      await appendSocialRefreshLog(supabaseAdmin, {
        run_id: runId,
        influencer_id: influencerId,
        influencer_name: influencerName,
        event: 'refreshed',
        message: `Updated ${accounts.length} social profile(s) for ${influencerName}.`,
      });
      await incrementRunCounters(runId, 'influencers_ok');
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    console.error('[social-refresh-batch]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
