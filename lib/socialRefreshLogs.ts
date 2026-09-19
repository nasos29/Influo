import type { SupabaseClient } from '@supabase/supabase-js';

export const SOCIAL_REFRESH_LOG_RETENTION_DAYS = 45;

export type SocialRefreshRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  influencers_total: number;
  influencers_ok: number;
  influencers_unapproved: number;
  message: string | null;
};

export type SocialRefreshLog = {
  id: string;
  run_id: string;
  created_at: string;
  level: string;
  influencer_id: string | null;
  influencer_name: string | null;
  platform: string | null;
  username: string | null;
  event: string;
  message: string;
};

export function isSessionDeadError(message: string): boolean {
  const msg = (message || '').trim();
  if (!msg) return false;
  return /no instagram session|no tiktok session|session expired|re-?sync cookies|re-?export cookies|not logged in|please log in|login wall|checkpoint|challenge required|cookies.*(expired|invalid|missing)|session.*(dead|invalid|missing|expired)|must (re-?)?(export|sync) cookies/i.test(
    msg
  );
}

export async function purgeOldSocialRefreshLogs(
  supabaseAdmin: SupabaseClient,
  retentionDays = SOCIAL_REFRESH_LOG_RETENTION_DAYS
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const { data, error } = await supabaseAdmin
    .from('social_refresh_runs')
    .delete()
    .lt('started_at', cutoff.toISOString())
    .select('id');
  if (error) {
    if (/relation|table|does not exist|schema cache/i.test(error.message)) {
      throw new Error('Missing tables. Run docs/ADD_SOCIAL_REFRESH_LOGS.sql in Supabase.');
    }
    throw new Error(error.message);
  }
  return data?.length ?? 0;
}

export async function createSocialRefreshRun(
  supabaseAdmin: SupabaseClient,
  influencersTotal: number
): Promise<SocialRefreshRun> {
  const { data, error } = await supabaseAdmin
    .from('social_refresh_runs')
    .insert({
      status: 'running',
      influencers_total: influencersTotal,
      message: 'Started on Oracle AuditPro',
    })
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(error?.message || 'Failed to create social refresh run');
  }
  return data as SocialRefreshRun;
}

export async function finishSocialRefreshRun(
  supabaseAdmin: SupabaseClient,
  runId: string,
  patch: {
    status: 'completed' | 'aborted' | 'failed';
    influencers_ok?: number;
    influencers_unapproved?: number;
    influencers_total?: number;
    message?: string;
  }
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('social_refresh_runs')
    .update({
      ...patch,
      finished_at: new Date().toISOString(),
    })
    .eq('id', runId);
  if (error) throw new Error(error.message);
}

export async function appendSocialRefreshLog(
  supabaseAdmin: SupabaseClient,
  row: {
    run_id: string;
    level?: 'info' | 'warn' | 'error';
    influencer_id?: string | null;
    influencer_name?: string | null;
    platform?: string | null;
    username?: string | null;
    event: string;
    message: string;
  }
): Promise<void> {
  const { error } = await supabaseAdmin.from('social_refresh_logs').insert({
    run_id: row.run_id,
    level: row.level || 'info',
    influencer_id: row.influencer_id ?? null,
    influencer_name: row.influencer_name ?? null,
    platform: row.platform ?? null,
    username: row.username ?? null,
    event: row.event,
    message: row.message,
  });
  if (error) throw new Error(error.message);
}

export function socialAccountsFromRow(
  accounts: unknown
): { platform: string; username: string }[] {
  if (!Array.isArray(accounts)) return [];
  const out: { platform: string; username: string }[] = [];
  for (const acc of accounts) {
    const platform = String(acc?.platform || '')
      .trim()
      .toLowerCase();
    const username = String(acc?.username || '')
      .trim()
      .replace(/^@+/, '');
    if (!username) continue;
    if (!['instagram', 'tiktok', 'youtube'].includes(platform)) continue;
    out.push({ platform, username });
  }
  return out;
}
