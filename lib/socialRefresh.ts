/**
 * Social stats refresh: Instagram + YouTube via Auditpr API, TikTok via Auditpr or Apify (sparingly).
 * Used by cron/refresh-social-stats to update followers, engagement_rate, avg_likes per account.
 */

export type SocialMetrics = {
  followers: string;
  engagement_rate: string;
  avg_likes: string;
};

function formatFollowers(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(num);
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
  const url = `${baseUrl.replace(/\/$/, '')}/metrics/instagram/${encodeURIComponent(u)}`;
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(45_000) });
    if (!res.ok) {
      const text = await res.text();
      return { error: `Auditpr ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as Record<string, unknown>;
    if (data.error) return { error: String(data.error) };
    const followers = Number(data.followers) || 0;
    const engagement_rate = typeof data.engagement_rate === 'string' ? data.engagement_rate : 'N/A';
    const avg_likes = Number(data.avg_likes) ?? 0;
    return {
      followers: formatFollowers(followers),
      engagement_rate,
      avg_likes: String(avg_likes),
    };
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
  const url = `${baseUrl.replace(/\/$/, '')}/metrics/youtube/${encodeURIComponent(u)}`;
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(45_000) });
    if (!res.ok) {
      const text = await res.text();
      return { error: `Auditpr ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as Record<string, unknown>;
    if (data.status === 'Failed' && data.error) return { error: String(data.error) };
    if (data.error) return { error: String(data.error) };
    const followers = Number(data.followers) || 0;
    const engagement_rate = typeof data.engagement_rate === 'string' ? data.engagement_rate : 'N/A';
    const avg_likes = Number(data.avg_likes) ?? 0;
    return {
      followers: formatFollowers(followers),
      engagement_rate,
      avg_likes: String(avg_likes),
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Auditpr request failed: ${msg}` };
  }
}

/**
 * Fetch TikTok metrics from Auditpr (no Apify cost on Influo server). Requires Auditpr running locally with APIFY_API_TOKEN.
 */
export async function fetchTiktokFromAuditpr(
  baseUrl: string,
  username: string
): Promise<SocialMetrics | { error: string }> {
  const u = username.replace(/^@+/, '').trim();
  if (!u) return { error: 'Username required' };
  const url = `${baseUrl.replace(/\/$/, '')}/metrics/tiktok/${encodeURIComponent(u)}`;
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(120_000) });
    if (!res.ok) {
      const text = await res.text();
      return { error: `Auditpr ${res.status}: ${text.slice(0, 200)}` };
    }
    const data = (await res.json()) as Record<string, unknown>;
    if (data.status === 'Failed' && data.error) return { error: String(data.error) };
    if (data.error) return { error: String(data.error) };
    const followers = Number(data.followers) || 0;
    const engagement_rate = typeof data.engagement_rate === 'string' ? data.engagement_rate : 'N/A';
    const avg_likes = Number(data.avg_likes) ?? 0;
    return {
      followers: formatFollowers(followers),
      engagement_rate,
      avg_likes: String(avg_likes),
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Auditpr request failed: ${msg}` };
  }
}

/** Parse TikTok Apify dataset items into followers, engagement_rate, avg_likes (Wednesday-style ER). */
function parseTiktokItems(items: Record<string, unknown>[]): SocialMetrics | null {
  if (!items.length) return null;
  const first = items[0] as Record<string, unknown>;
  const author = (first.authorMeta ?? first.author) as Record<string, unknown> | undefined;
  let followers =
    Number(first.followers ?? first.followerCount) ||
    (author ? Number(author.fans ?? author.followers) : 0) ||
    0;

  const likesList: number[] = [];
  const commentsList: number[] = [];
  const sharesList: number[] = [];
  for (const item of items) {
    const o = item as Record<string, unknown>;
    const lk = Number(o.likes ?? o.diggCount ?? o.heartCount ?? 0);
    const comm = Number(o.comment_count ?? o.commentCount ?? o.comments ?? 0);
    const sh = Number(o.share_count ?? o.shareCount ?? o.shares ?? 0);
    if (lk >= 0) likesList.push(lk);
    if (comm >= 0) commentsList.push(comm);
    if (sh >= 0) sharesList.push(sh);
  }
  const avgLikes = likesList.length ? Math.round(likesList.reduce((a, b) => a + b, 0) / likesList.length) : 0;
  const avgComments = commentsList.length
    ? commentsList.reduce((a, b) => a + b, 0) / commentsList.length
    : 0;
  const avgShares = sharesList.length ? sharesList.reduce((a, b) => a + b, 0) / sharesList.length : 0;
  const totalEngagement = avgLikes + avgComments + avgShares;
  const engagement_rate =
    followers > 0 && totalEngagement >= 0
      ? `${((totalEngagement / followers) * 100).toFixed(2)}%`
      : 'N/A';

  return {
    followers: formatFollowers(followers),
    engagement_rate,
    avg_likes: String(avgLikes),
  };
}

/** Run Apify TikTok actor, poll until done, return dataset items. Use sparingly (cost). */
async function runApifyTiktok(
  token: string,
  actorId: string,
  input: Record<string, unknown>
): Promise<{ items: Record<string, unknown>[]; error?: string }> {
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${encodeURIComponent(token)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
  );
  if (!runRes.ok) return { items: [], error: `Apify run ${runRes.status}` };
  const runData = (await runRes.json()) as { data?: { id?: string } };
  const runId = runData?.data?.id;
  if (!runId) return { items: [], error: 'Apify run failed' };

  const maxAttempts = 60;
  const pollIntervalMs = 2000;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(token)}`
    );
    if (!statusRes.ok) return { items: [], error: 'Apify status failed' };
    const statusData = (await statusRes.json()) as { data?: { status?: string; defaultDatasetId?: string } };
    const status = statusData?.data?.status;
    if (status === 'SUCCEEDED') {
      const datasetId = statusData?.data?.defaultDatasetId;
      if (!datasetId) return { items: [], error: 'No dataset' };
      const itemsRes = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(token)}`
      );
      if (!itemsRes.ok) return { items: [], error: 'Apify dataset failed' };
      const raw = (await itemsRes.json()) as unknown;
      const items = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
      return { items: items as Record<string, unknown>[] };
    }
    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      return { items: [], error: status ?? 'Run failed' };
    }
  }
  return { items: [], error: 'Apify timed out' };
}

const TIKTOK_MAX_ITEMS = 25;

/**
 * Fetch TikTok metrics via Apify (costs). Use sparingly. Tries apidojo then clockworks.
 */
export async function fetchTiktokFromApify(
  apifyToken: string,
  username: string
): Promise<SocialMetrics | { error: string }> {
  const u = username.replace(/^@/, '').trim();
  if (!u) return { error: 'Username required' };
  if (!apifyToken.trim()) return { error: 'APIFY_API_TOKEN required for TikTok' };

  let items: Record<string, unknown>[] = [];
  let lastError = 'No results';

  // 1) apidojo
  const run1 = await runApifyTiktok(apifyToken, 'apidojo~tiktok-profile-scraper', {
    usernames: [u],
    maxItems: TIKTOK_MAX_ITEMS,
  });
  if (run1.error) lastError = run1.error;
  else {
    const real = run1.items.filter((x) => x && !(x as Record<string, unknown>).demo && !(x as Record<string, unknown>).noResults);
    const parsed = real.length ? parseTiktokItems(real) : null;
    if (parsed) return parsed;
    lastError = 'Apify returned demo/empty';
  }

  // 2) clockworks fallback
  const run2 = await runApifyTiktok(apifyToken, 'clockworks~tiktok-profile-scraper', {
    profiles: [u],
    resultsPerPage: TIKTOK_MAX_ITEMS,
  });
  if (run2.error) return { error: `${lastError}. Clockworks: ${run2.error}` };
  items = run2.items;
  const parsed = parseTiktokItems(items);
  if (parsed) return parsed;
  return { error: `${lastError}. Both actors returned no usable data.` };
}
