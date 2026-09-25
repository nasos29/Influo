/**
 * Social stats refresh via Auditpr (session-only: IG/TikTok cookies + Playwright on Auditpr).
 * Used by admin "Ανανέωση Social" and cron refresh routes.
 */

import { detectErFlag, type ErFlagReason } from '@/lib/engagementFlags';

export type SocialMetrics = {
  followers: string;
  engagement_rate: string;
  avg_likes: string;
  posts_count?: number;
  avg_views?: number | null;
  /** Suspicious / unreliable ER — shown on profile */
  er_suspicious?: boolean;
  er_flag_reason?: ErFlagReason;
  suspected_fake_penalty?: boolean;
  engagement_hidden?: boolean;
  /**
   * From Auditpr `is_private` (IG may still return metrics if our session follows them),
   * or set true on private scrape errors in refreshSocialStats.
   */
  is_private?: boolean;
};

/** True when Auditpr / scrape error indicates a private/locked profile. */
export function isPrivateProfileError(error: string | null | undefined): boolean {
  if (!error) return false;
  return /\bprivate\b|ιδιωτικ/i.test(error);
}

function formatFollowers(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(num);
}

/** Parse followers from API: number, "39943", or "39.9k" / "1.2M" so we never lose precision. */
function parseFollowersFromApi(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const s = typeof value === 'string' ? value.trim() : String(value ?? '');
  if (!s) return 0;
  const num = Number(s);
  if (Number.isFinite(num)) return Math.round(num);
  const match = s.replace(/,/g, '').match(/^([\d.]+)\s*([kKmM])?$/);
  if (!match) return 0;
  const n = parseFloat(match[1]);
  const suffix = (match[2] || '').toLowerCase();
  if (suffix === 'k') return Math.round(n * 1_000);
  if (suffix === 'm') return Math.round(n * 1_000_000);
  return Math.round(n);
}

function pickPositiveCount(data: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    if (!(key in data) || data[key] == null || data[key] === '') continue;
    const n = parseFollowersFromApi(data[key]);
    if (n > 0) return n;
  }
  return null;
}

function metricsFromAuditprData(
  data: Record<string, unknown>,
  username: string
): SocialMetrics | { error: string } {
  if (data.status === 'Failed' || data.error) {
    const raw = String(data.error || data.error_detail || 'Auditpr metrics failed');
    if (/private/i.test(raw)) {
      return { error: `Private profile: το προφίλ @${username} είναι ιδιωτικό.` };
    }
    if (/not found|banned|does not exist|user banned/i.test(raw)) {
      return { error: `Λάθος username: το προφίλ @${username} δεν υπάρχει.` };
    }
    return { error: raw };
  }
  if (data.followers == null) {
    return { error: `Λάθος username: το προφίλ @${username} δεν υπάρχει.` };
  }
  const followers = parseFollowersFromApi(data.followers);
  const avg_likes = Number(data.avg_likes) || 0;
  const engagement_rate = typeof data.engagement_rate === 'string' ? data.engagement_rate : 'N/A';
  const posts = parseFollowersFromApi(data.posts_count);
  const avg_views = pickPositiveCount(data, [
    'avg_views',
    'avg_plays',
    'average_views',
    'avg_video_views',
    'avg_view_count',
  ]);
  if (followers === 0 && avg_likes === 0 && posts === 0) {
    return { error: `Λάθος username: το προφίλ @${username} δεν υπάρχει.` };
  }
  const erFlag = detectErFlag({
    engagement_rate,
    posts_count: posts,
    avg_likes,
    suspected_fake_penalty: data.suspected_fake_penalty === true,
    engagement_hidden: data.engagement_hidden === true,
    engagement_rate_raw: typeof data.engagement_rate_raw === 'string' ? data.engagement_rate_raw : null,
  });
  return {
    followers: formatFollowers(followers),
    engagement_rate,
    avg_likes: String(avg_likes),
    posts_count: posts,
    avg_views,
    suspected_fake_penalty: data.suspected_fake_penalty === true,
    engagement_hidden: data.engagement_hidden === true,
    is_private: data.is_private === true || data.private === true,
    ...(erFlag
      ? { er_suspicious: true, er_flag_reason: erFlag.reason }
      : { er_suspicious: false, er_flag_reason: undefined }),
  };
}

export function isUsableSocialMetrics(x: SocialMetrics | { error: string }): x is SocialMetrics {
  if (!x || typeof x !== 'object') return false;
  if ('error' in x && (x as { error?: string }).error) return false;
  if (!('followers' in x)) return false;
  const m = x as SocialMetrics;
  const followers = parseFollowersFromApi(m.followers);
  const likes = Number(m.avg_likes) || 0;
  const er = String(m.engagement_rate || '').trim();
  if (followers === 0 && likes === 0 && (er === '' || er.toUpperCase() === 'N/A')) {
    return false;
  }
  return true;
}

/**
 * Fetch Instagram metrics from Auditpr (no Apify cost). Requires Auditpr running with valid IG session.
 */
export async function fetchInstagramFromAuditpr(
  baseUrl: string,
  username: string
): Promise<SocialMetrics | { error: string }> {
  const u = username.replace(/^@/, '').trim();
  if (!u) return { error: 'Username required' };
    const url = `${baseUrl.replace(/\/$/, '')}/metrics/instagram/${encodeURIComponent(u)}?for_import=true`;
    try {
    // Playwright IG fallback on Auditpr can take up to ~90s per profile.
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(95_000) });
    if (!res.ok) {
      const text = await res.text();
      return { error: `Auditpr ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as Record<string, unknown>;
    return metricsFromAuditprData(data, u);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Auditpr request failed: ${msg}` };
  }
}

/**
 * Fetch YouTube metrics from Auditpr (YouTube Data API v3).
 * Requires Auditpr running with YOUTUBE_API_KEY in .env.
 */
export async function fetchYouTubeFromAuditpr(
  baseUrl: string,
  username: string
): Promise<SocialMetrics | { error: string }> {
  const u = username.replace(/^@+/, '').trim();
  if (!u) return { error: 'Username required' };
    const url = `${baseUrl.replace(/\/$/, '')}/metrics/youtube/${encodeURIComponent(u)}?for_import=true`;
    try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(45_000) });
    if (!res.ok) {
      const text = await res.text();
      return { error: `Auditpr ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as Record<string, unknown>;
    return metricsFromAuditprData(data, u);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Auditpr request failed: ${msg}` };
  }
}

/**
 * Fetch TikTok metrics from Auditpr (session cookies + local browser, no Apify).
 */
export async function fetchTiktokFromAuditpr(
  baseUrl: string,
  username: string
): Promise<SocialMetrics | { error: string }> {
  const u = username.replace(/^@+/, '').trim();
  if (!u) return { error: 'Username required' };
    const url = `${baseUrl.replace(/\/$/, '')}/metrics/tiktok/${encodeURIComponent(u)}?for_import=true`;
    try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(120_000) });
    if (!res.ok) {
      const text = await res.text();
      return { error: `Auditpr ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as Record<string, unknown>;
    return metricsFromAuditprData(data, u);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Auditpr request failed: ${msg}` };
  }
}

export type AccountFetchResult = {
  platform: string;
  username: string;
  status: 'success' | 'failed';
  followers?: string;
  engagement_rate?: string;
  avg_likes?: string;
  posts_count?: number;
  avg_views?: number | null;
  error?: string;
};

export type SocialOverridesBundle = {
  instagramOverrides: Record<string, SocialMetrics>;
  tiktokOverrides: Record<string, SocialMetrics>;
  youtubeOverrides: Record<string, SocialMetrics>;
  errors: string[];
  accountResults: AccountFetchResult[];
};

/** Quick health check before batch refresh from admin browser. */
export async function checkAuditprHealth(baseUrl: string): Promise<{ ok: boolean; error?: string }> {
  const url = `${baseUrl.replace(/\/$/, '')}/health`;
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { ok: false, error: `Auditpr health ${res.status}` };
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

/**
 * Fetch IG/TikTok/YouTube metrics from Auditpr for a list of accounts (deduped).
 * Used by admin dashboard refresh (single + all influencers).
 */
export async function fetchAuditprOverridesForAccounts(
  baseUrl: string,
  accounts: { platform?: string; username?: string }[],
  options?: { delayMs?: number }
): Promise<SocialOverridesBundle> {
  const instagramOverrides: Record<string, SocialMetrics> = {};
  const tiktokOverrides: Record<string, SocialMetrics> = {};
  const youtubeOverrides: Record<string, SocialMetrics> = {};
  const errors: string[] = [];
  const accountResults: AccountFetchResult[] = [];
  const delayMs = options?.delayMs ?? 1500;

  const jobs: { platform: 'instagram' | 'tiktok' | 'youtube'; username: string }[] = [];
  const seen = new Set<string>();
  for (const acc of accounts) {
    const platform = (acc.platform || '').trim().toLowerCase();
    const username = (acc.username || '').trim();
    if (!platform || !username) continue;
    if (platform !== 'instagram' && platform !== 'tiktok' && platform !== 'youtube') continue;
    const uKey = username.replace(/^@+/, '').trim();
    const dedupeKey = `${platform}:${uKey.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    jobs.push({ platform, username: uKey });
  }

  for (let i = 0; i < jobs.length; i++) {
    const { platform, username } = jobs[i];
    let result: SocialMetrics | { error: string };
    if (platform === 'instagram') {
      result = await fetchInstagramFromAuditpr(baseUrl, username);
    } else if (platform === 'tiktok') {
      result = await fetchTiktokFromAuditpr(baseUrl, username);
    } else {
      result = await fetchYouTubeFromAuditpr(baseUrl, username);
    }

    if (isUsableSocialMetrics(result)) {
      if (platform === 'instagram') instagramOverrides[username] = result;
      else if (platform === 'tiktok') tiktokOverrides[username] = result;
      else youtubeOverrides[username] = result;
      accountResults.push({
        platform,
        username,
        status: 'success',
        followers: result.followers,
        engagement_rate: result.engagement_rate,
        avg_likes: result.avg_likes,
        posts_count: result.posts_count,
        avg_views: result.avg_views,
      });
    } else {
      const u = username.replace(/^@+/, '').trim();
      const errMsg = 'error' in result && result.error
        ? result.error
        : `Λάθος username: το προφίλ @${u} δεν υπάρχει.`;
      errors.push(`${platform} @${u}: ${errMsg}`);
      accountResults.push({
        platform,
        username: u,
        status: 'failed',
        error: errMsg,
      });
    }

    if (i < jobs.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { instagramOverrides, tiktokOverrides, youtubeOverrides, errors, accountResults };
}
