import { GoogleGenerativeAI } from '@google/generative-ai';
import { parseFollowerString } from '@/lib/parseFollowers';

export const INSIGHTS_FOLLOWER_MISMATCH_RATIO = 0.2;

export type InsightsScrapedAccount = {
  platform?: string;
  username?: string;
  followers?: string;
  avg_likes?: string;
  ok?: boolean;
};

export type InsightsVisionAccount = {
  platform?: string;
  username?: string;
  followers?: number | null;
  avg_likes?: number | null;
};

export type LenientInsightsCheckResult = {
  passed: boolean;
  analytics_verified: boolean;
  reason: string;
  note: string | null;
};

export function normalizeInsightsHandle(handle: string): string {
  return String(handle || '')
    .replace(/^@+/, '')
    .trim()
    .toLowerCase();
}

/** Rule-based mismatch (unit-testable without Gemini). */
export function insightsMetricsMismatchReason(
  scraped: { platform: string; username: string; followers: number; avgLikes: number },
  fromInsights: InsightsVisionAccount
): string | null {
  const expected = normalizeInsightsHandle(scraped.username);
  const seen = normalizeInsightsHandle(String(fromInsights.username || ''));
  if (seen && expected && seen !== expected) {
    return `Handle mismatch: screenshot @${seen} vs scraped @${expected} (${scraped.platform})`;
  }
  const shotFollowers = fromInsights.followers;
  if (shotFollowers != null && Number.isFinite(shotFollowers) && scraped.followers > 0) {
    const delta = Math.abs(shotFollowers - scraped.followers) / scraped.followers;
    if (delta > INSIGHTS_FOLLOWER_MISMATCH_RATIO) {
      return `Followers differ by ${Math.round(delta * 100)}% on ${scraped.platform} (screenshot ${shotFollowers} vs scraped ${scraped.followers})`;
    }
  }
  const shotLikes = fromInsights.avg_likes != null ? Number(fromInsights.avg_likes) : null;
  const fol = shotFollowers != null && shotFollowers > 0 ? shotFollowers : scraped.followers;
  if (shotLikes != null && Number.isFinite(shotLikes) && fol > 0 && shotLikes > fol) {
    return `Likes (${shotLikes}) > followers (${fol}) on ${scraped.platform} insights screenshot`;
  }
  return null;
}

export function evaluateInsightsRulesAgainstScrape(
  scrapedAccounts: InsightsScrapedAccount[],
  visionAccounts: InsightsVisionAccount[]
): { passed: boolean; reason: string } {
  const visionByPlatform = new Map<string, InsightsVisionAccount>();
  for (const v of visionAccounts) {
    const p = String(v.platform || '').toLowerCase();
    if (p) visionByPlatform.set(p, v);
  }
  for (const acc of scrapedAccounts) {
    if (acc.ok === false) continue;
    const platform = String(acc.platform || '').toLowerCase();
    const username = String(acc.username || '').trim();
    if (!platform || !username) continue;
    const followers = parseFollowerString(acc.followers);
    const avgLikes = parseFollowerString(acc.avg_likes);
    const vision = visionByPlatform.get(platform);
    if (!vision) continue;
    const mismatch = insightsMetricsMismatchReason(
      { platform, username, followers, avgLikes },
      vision
    );
    if (mismatch) return { passed: false, reason: mismatch };
  }
  if (visionAccounts.length === 0) {
    return { passed: false, reason: 'No metrics extracted from insights screenshots' };
  }
  const hasComparableScrape = scrapedAccounts.some((acc) => {
    if (acc.ok === false) return false;
    const platform = String(acc.platform || '').toLowerCase();
    const username = String(acc.username || '').trim();
    return Boolean(platform && username);
  });
  if (!hasComparableScrape) {
    return { passed: false, reason: 'All scrapes failed; nothing to compare against insights' };
  }
  return { passed: true, reason: 'Insights screenshots match scraped metrics' };
}

function parseInsightsUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((u) => String(u || '').trim()).filter(Boolean);
}

async function fetchImageAsBase64(url: string, timeoutMs = 20000): Promise<{ mime: string; data: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) return null;
    const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    return { mime: mime || 'image/jpeg', data: buf.toString('base64') };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function extractMetricsFromInsightsUrls(
  urls: string[],
  scrapedAccounts: InsightsScrapedAccount[]
): Promise<InsightsVisionAccount[]> {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');

  const modelId = (process.env.GEMINI_INSIGHTS_MODEL || 'gemini-flash-lite-latest').trim();
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  const scrapedSummary = scrapedAccounts
    .filter((a) => a.ok !== false)
    .map((a) => ({
      platform: String(a.platform || '').toLowerCase(),
      username: String(a.username || '').replace(/^@+/, ''),
      followers: parseFollowerString(a.followers),
      avg_likes: parseFollowerString(a.avg_likes),
    }));
  parts.push({
    text: `You read influencer analytics/insights screenshots. Extract per-platform metrics as JSON only.
Scraped reference (for matching platform): ${JSON.stringify(scrapedSummary)}

Return JSON shape:
{"accounts":[{"platform":"instagram","username":"handle","followers":1234,"avg_likes":56}]}
Use null for unknown numbers. Username without @.`,
  });

  let attached = 0;
  for (const url of urls.slice(0, 4)) {
    const img = await fetchImageAsBase64(url);
    if (!img) continue;
    parts.push({ inlineData: { mimeType: img.mime, data: img.data } });
    attached += 1;
  }
  if (!attached) throw new Error('Could not load insights images');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelId,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  });
  const result = await model.generateContent(parts);
  const text = result.response.text?.()?.trim() ?? '';
  if (!text) throw new Error('Empty Gemini vision response');
  let parsed: { accounts?: InsightsVisionAccount[] };
  try {
    parsed = JSON.parse(text) as { accounts?: InsightsVisionAccount[] };
  } catch {
    throw new Error('Invalid JSON from Gemini vision');
  }
  return Array.isArray(parsed.accounts) ? parsed.accounts : [];
}

/**
 * Lenient check for ApproveNew: never blocks approval; sets analytics_verified only on pass.
 */
export async function runLenientInsightsCheck(input: {
  insights_urls: unknown;
  scrapedAccounts: InsightsScrapedAccount[];
}): Promise<LenientInsightsCheckResult> {
  const urls = parseInsightsUrls(input.insights_urls);
  if (!urls.length) {
    return {
      passed: false,
      analytics_verified: false,
      reason: 'no_insights',
      note: null,
    };
  }

  try {
    const visionAccounts = await extractMetricsFromInsightsUrls(urls, input.scrapedAccounts);
    const rules = evaluateInsightsRulesAgainstScrape(input.scrapedAccounts, visionAccounts);
    if (rules.passed) {
      return {
        passed: true,
        analytics_verified: true,
        reason: rules.reason,
        note: null,
      };
    }
    const note = `ApproveNew Insights check: ${rules.reason}`;
    return {
      passed: false,
      analytics_verified: false,
      reason: rules.reason,
      note,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      passed: false,
      analytics_verified: false,
      reason: `vision_error: ${msg}`,
      note: `ApproveNew Insights check failed (vision): ${msg}`,
    };
  }
}