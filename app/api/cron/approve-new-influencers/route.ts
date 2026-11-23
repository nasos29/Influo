/**
 * Oracle every-4h job: new (never approved) influencers with social usernames.
 * Scraping is on the VM. This route lists, persists stats, translates bios,
 * verifies analytics, and approves.
 *
 * AuditPro contract (do not change): POST with Authorization Bearer CRON_SECRET.
 * Actions: start → { run, influencers, purged }; apply → { ok, bioNote, result }
 * or { ok:false, skipped|aborted, ... }; also log, abort, finish.
 * Reads/writes influencers with the server service role (contact_email for the
 * approval email, accounts, approved, approved_at). Browser column locks do not apply.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { copyAuditprErExtras } from '@/lib/engagementFlags';
import { GEMINI_PAUSED_MSG, isGeminiPaused } from '@/lib/geminiPause';
import { doRefreshSocialStats, type InstagramOverrides, type TikTokOverrides, type YouTubeOverrides } from '@/lib/refreshSocialStats';
import { finalizeNewInfluencerApproval } from '@/lib/approveNewInfluencer';
import { sanitizeTopPosts } from '@/lib/topPosts';
import { handleMissingAccountNoticesForNewApproval } from '@/lib/missingAccountEmail';
import {
  handlesSnapshotFromScrapeAccounts,
  shouldSetWrongUsernameHold,
  shouldSkipWrongUsernameHeldCreator,
  type WrongUsernameHandle,
} from '@/lib/wrongUsernameHold';
import { alertAdminUnapproved } from '@/lib/unapprovedAdminAlert';
import { isProtectedTestAccount } from '@/lib/protectedAccount';
import { writeApproveNewInsightsAdminNote } from '@/lib/approveNewInsightsNotes';
import { runApproveNewPreview } from '@/lib/approveNewDryRun';
import { runLenientInsightsCheck } from '@/lib/lenientInsightsCheck';
import { getServerSupabaseUrl } from "@/lib/supabaseServerUrl";
import {
  appendSocialRefreshLog,
  createSocialRefreshRun,
  finishSocialRefreshRun,
  isSessionDeadError,
  purgeOldSocialRefreshLogs,
  socialAccountsFromRow,
} from '@/lib/socialRefreshLogs';

export const maxDuration = 60;

const supabaseAdmin = createClient(getServerSupabaseUrl(),
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
  posts_count?: number;
  avg_views?: number | null;
  suspected_fake_penalty?: boolean;
  engagement_hidden?: boolean;
  engagement_rate_raw?: string;
  fake_follower_percent?: number | string;
  suspected_fake_percent?: number | string;
  fake_followers_percent?: number | string;
  quality_penalty_percent?: number | string;
  er_penalty_percent?: number | string;
  penalty_percent?: number | string;
  error?: string;
};

const UNAPPROVED_LIST_VARIANTS: Array<{
  select: string;
  requireApprovedAtNull: boolean;
  requireManualUnapprovedAtNull: boolean;
}> = [
  {
    select:
      'id, display_name, approved, approved_at, manual_unapproved_at, accounts, wrong_username_held_at, wrong_username_handles, bio, bio_en, insights_urls',
    requireApprovedAtNull: true,
    requireManualUnapprovedAtNull: true,
  },
  {
    select: 'id, display_name, approved, approved_at, manual_unapproved_at, accounts',
    requireApprovedAtNull: true,
    requireManualUnapprovedAtNull: true,
  },
  {
    select: 'id, display_name, approved, approved_at, accounts',
    requireApprovedAtNull: true,
    requireManualUnapprovedAtNull: false,
  },
  {
    select: 'id, display_name, approved, accounts',
    requireApprovedAtNull: false,
    requireManualUnapprovedAtNull: false,
  },
];

function isMissingInfluencersColumnError(message: string): boolean {
  return /column|wrong_username|manual_unapproved_at|approved_at/i.test(message);
}

async function fetchUnapprovedInfluencerPage(from: number, pageSize: number): Promise<Record<string, unknown>[]> {
  let lastError: string | null = null;
  for (const variant of UNAPPROVED_LIST_VARIANTS) {
    let query = supabaseAdmin.from('influencers').select(variant.select).eq('approved', false);
    if (variant.requireApprovedAtNull) query = query.is('approved_at', null);
    if (variant.requireManualUnapprovedAtNull) query = query.is('manual_unapproved_at', null);
    const result = await query.range(from, from + pageSize - 1);
    if (!result.error) {
      return (result.data ?? []) as unknown as Record<string, unknown>[];
    }
    if (isMissingInfluencersColumnError(result.error.message)) {
      lastError = result.error.message;
      continue;
    }
    throw new Error(result.error.message);
  }
  throw new Error(lastError || 'Unable to list unapproved influencers');
}

async function writeWrongUsernameHold(influencerId: string, handles: WrongUsernameHandle[] | null): Promise<void> {
  const action = handles ? 'set' : 'clear';
  const { error } = await supabaseAdmin
    .from('influencers')
    .update({
      wrong_username_held_at: handles ? new Date().toISOString() : null,
      wrong_username_handles: handles,
    })
    .eq('id', influencerId);
  if (error && !/column|wrong_username/i.test(error.message)) {
    console.warn(`[approve-new-influencers] wrong_username hold ${action}`, error.message);
  }
}

function parseInsightsUrlsField(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const urls = raw.map((u) => String(u || '').trim()).filter(Boolean);
  return urls.length ? urls : null;
}

async function listNewUnapprovedWithSocials(opts?: { includeDryRunFields?: boolean }) {
  const pageSize = 1000;
  const influencers: {
    id: string;
    display_name: string;
    accounts: { platform: string; username: string }[];
    bio?: string | null;
    bio_en?: string | null;
    insights_urls?: string[] | null;
  }[] = [];

  for (let from = 0; ; from += pageSize) {
    const rows = await fetchUnapprovedInfluencerPage(from, pageSize);
    const heldIds = rows
      .filter((row) => row.wrong_username_held_at)
      .map((row) => String(row.id));
    const profileChangesByInfluencer = new Map<string, string[]>();
    if (heldIds.length) {
      const { data: changeRows, error: changeErr } = await supabaseAdmin
        .from('profile_changes')
        .select('influencer_id, created_at')
        .in('influencer_id', heldIds);
      if (!changeErr) {
        for (const ch of changeRows ?? []) {
          const id = String((ch as { influencer_id?: string }).influencer_id || '');
          const createdAt = String((ch as { created_at?: string }).created_at || '');
          if (!id || !createdAt) continue;
          const list = profileChangesByInfluencer.get(id) ?? [];
          list.push(createdAt);
          profileChangesByInfluencer.set(id, list);
        }
      } else if (!/relation|does not exist|schema cache/i.test(changeErr.message)) {
        console.warn('[approve-new-influencers] profile_changes', changeErr.message);
      }
    }

    for (const row of rows) {
      if (row.approved_at) continue;
      if (row.manual_unapproved_at) continue;
      const accounts = socialAccountsFromRow(row.accounts);
      if (!accounts.length) continue;
      const influencerId = String(row.id);
      const skipHeld = shouldSkipWrongUsernameHeldCreator({
        wrong_username_held_at: row.wrong_username_held_at
          ? String(row.wrong_username_held_at)
          : null,
        wrong_username_handles: row.wrong_username_handles,
        accounts,
        profileChangeTimestamps: profileChangesByInfluencer.get(influencerId) ?? [],
      });
      if (skipHeld) continue;
      const item: (typeof influencers)[number] = {
        id: influencerId,
        display_name: String(row.display_name || row.id),
        accounts,
      };
      if (opts?.includeDryRunFields) {
        item.bio = row.bio != null ? String(row.bio) : null;
        item.bio_en = row.bio_en != null ? String(row.bio_en) : null;
        item.insights_urls = parseInsightsUrlsField(row.insights_urls);
      }
      influencers.push(item);
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
    const influencers = await listNewUnapprovedWithSocials();
    // Idle polls from Oracle: cheap empty response (no side effects).
    if (influencers.length === 0) {
      return NextResponse.json({ influencers: [], count: 0, job: 'approve_new', idle: true });
    }
    return NextResponse.json({ influencers, count: influencers.length, job: 'approve_new' });
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

    if (action === 'list') {
      const influencers = await listNewUnapprovedWithSocials({ includeDryRunFields: true });
      return NextResponse.json({ influencers, count: influencers.length, job: 'approve_new', dry_run: true });
    }

    if (action === 'preview') {
      const influencerId = String(body?.influencer_id || '').trim();
      const influencerName = String(body?.influencer_name || influencerId);
      const accounts = (Array.isArray(body?.accounts) ? body.accounts : []) as ScrapedAccount[];
      if (!influencerId || !accounts.length) {
        return NextResponse.json({ error: 'influencer_id and accounts required' }, { status: 400 });
      }
      const preview = await runApproveNewPreview(supabaseAdmin, {
        influencerId,
        influencerName,
        accounts,
      });
      return NextResponse.json({ ok: true, dry_run: true, ...preview });
    }

    if (action === 'start') {
      if (isGeminiPaused()) {
        return NextResponse.json({
          run: null,
          influencers: [],
          purged: 0,
          paused: true,
          message: GEMINI_PAUSED_MSG,
        });
      }
      const influencers = await listNewUnapprovedWithSocials();
      // Oracle was polling ~every 2 min; when idle skip purge/run creation entirely.
      if (influencers.length === 0) {
        return NextResponse.json({
          run: null,
          influencers: [],
          purged: 0,
          idle: true,
        });
      }
      const purged = await purgeOldSocialRefreshLogs(supabaseAdmin);
      const run = await createSocialRefreshRun(
        supabaseAdmin,
        influencers.length,
        'New-influencer approval started on Oracle'
      );
      await appendSocialRefreshLog(supabaseAdmin, {
        run_id: run.id,
        event: 'run_started',
        message: `New-influencer job: ${influencers.length} candidate(s). Purged ${purged} old run(s).`,
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
      const message = String(body?.message || 'Instagram/TikTok session stopped. New-influencer job aborted.');
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
      await finishSocialRefreshRun(supabaseAdmin, runId, { status: 'aborted', message });
      return NextResponse.json({ ok: true, aborted: true });
    }

    if (action === 'finish') {
      const runId = String(body?.run_id || '').trim();
      if (!runId) return NextResponse.json({ error: 'run_id required' }, { status: 400 });
      await appendSocialRefreshLog(supabaseAdmin, {
        run_id: runId,
        event: 'run_finished',
        message: String(body?.message || 'New-influencer job finished.'),
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

      const { data: current } = await supabaseAdmin
        .from('influencers')
        .select('approved, approved_at')
        .eq('id', influencerId)
        .maybeSingle();
      if (current?.approved || current?.approved_at) {
        await appendSocialRefreshLog(supabaseAdmin, {
          run_id: runId,
          influencer_id: influencerId,
          influencer_name: influencerName,
          event: 'skipped',
          message: `${influencerName} is not a new influencer (already had an approval).`,
        });
        return NextResponse.json({ ok: false, skipped: true });
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
        await finishSocialRefreshRun(supabaseAdmin, runId, { status: 'aborted', message });
        return NextResponse.json({ ok: false, aborted: true, session_dead: true, message });
      }

      const profileErrors = accounts.filter((a) => !a.ok);
      if (profileErrors.length || !accounts.length) {
        const detail = profileErrors.length
          ? profileErrors.map((a) => `${a.platform} @${a.username}: ${a.error || 'error'}`).join(' | ')
          : 'No social profiles scraped';
        await appendSocialRefreshLog(supabaseAdmin, {
          run_id: runId,
          level: 'warn',
          influencer_id: influencerId,
          influencer_name: influencerName,
          event: 'skipped',
          message: `Left unapproved (new influencer). ${detail}`,
        });
        await incrementRunCounters(runId, 'influencers_unapproved');
        await alertAdminUnapproved(supabaseAdmin, { runId, influencerId, influencerName, reason: `Σφάλμα προφίλ: ${detail}` });
        await handleMissingAccountNoticesForNewApproval(supabaseAdmin, influencerId, influencerName, accounts).catch(
          (err) =>
            console.warn(
              '[approve-new-influencers] missing account mail',
              err instanceof Error ? err.message : err
            )
        );
        // At least one clear permanent missing still sets hold even when other accounts failed transiently.
        if (shouldSetWrongUsernameHold(accounts)) {
          await writeWrongUsernameHold(influencerId, handlesSnapshotFromScrapeAccounts(accounts));
        }
        return NextResponse.json({ ok: false, skipped: true, errors: profileErrors.map((a) => a.error) });
      }

      const { data: identityRow } = await supabaseAdmin
        .from('influencers')
        .select('display_name, contact_email')
        .eq('id', influencerId)
        .maybeSingle();
      if (
        isProtectedTestAccount({
          display_name: identityRow?.display_name ?? influencerName,
          contact_email: identityRow?.contact_email,
        })
      ) {
        const reason = 'Δοκιμαστικός λογαριασμός (test): χωρίς αυτόματη έγκριση';
        await appendSocialRefreshLog(supabaseAdmin, {
          run_id: runId,
          level: 'info',
          influencer_id: influencerId,
          influencer_name: influencerName,
          event: 'skipped',
          message: `Left unapproved (protected test account). ${reason}`,
        });
        await incrementRunCounters(runId, 'influencers_unapproved');
        await alertAdminUnapproved(supabaseAdmin, { runId, influencerId, influencerName, reason });
        return NextResponse.json({ ok: false, skipped: true, test_account: true });
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
          ...(acc.posts_count != null ? { posts_count: Number(acc.posts_count) } : {}),
          ...(acc.avg_views != null && Number(acc.avg_views) > 0 ? { avg_views: Number(acc.avg_views) } : {}),
          ...copyAuditprErExtras(acc),
          // Same as the bulk refresh: keep Auditpr top_posts when it sent them.
          ...(Object.hasOwn(acc, 'top_posts')
            ? { top_posts: sanitizeTopPosts((acc as { top_posts?: unknown }).top_posts) }
            : {}),
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
      await writeWrongUsernameHold(influencerId, null);
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
        await incrementRunCounters(runId, 'influencers_unapproved');
        await alertAdminUnapproved(supabaseAdmin, { runId, influencerId, influencerName, reason: `Σφάλμα αποθήκευσης στατιστικών: ${persistErrors.join(' | ')}` });
        return NextResponse.json({ ok: false, skipped: true, errors: persistErrors });
      }

      const { data: insightsRow } = await supabaseAdmin
        .from('influencers')
        .select('insights_urls')
        .eq('id', influencerId)
        .maybeSingle();
      const insightsCheck = await runLenientInsightsCheck({
        insights_urls: insightsRow?.insights_urls,
        scrapedAccounts: accounts,
      });
      if (insightsCheck.note) {
        await writeApproveNewInsightsAdminNote(supabaseAdmin, influencerId, insightsCheck.note);
      }
      const finalized = await finalizeNewInfluencerApproval(supabaseAdmin, influencerId, {
        analyticsVerified: insightsCheck.analytics_verified,
      });
      await appendSocialRefreshLog(supabaseAdmin, {
        run_id: runId,
        influencer_id: influencerId,
        influencer_name: influencerName,
        event: finalized.approved ? 'approved' : 'skipped',
        message: finalized.approved
          ? `Approved ${influencerName}. ${finalized.bioNote}`
          : finalized.bioNote,
      });
      if (finalized.approved) {
        await incrementRunCounters(runId, 'influencers_ok');
      } else {
        await incrementRunCounters(runId, 'influencers_unapproved');
        await alertAdminUnapproved(supabaseAdmin, { runId, influencerId, influencerName, reason: finalized.bioNote || 'Δεν πέρασε τον τελικό έλεγχο' });
      }
      return NextResponse.json({ ok: finalized.approved, bioNote: finalized.bioNote, result });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    console.error('[approve-new-influencers]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
