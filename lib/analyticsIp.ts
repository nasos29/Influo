/**
 * Analytics IP hashing + bot UA detection for influencer_analytics inserts.
 * Never store raw IPs — only sha256(ip + ANALYTICS_IP_SALT).
 */

import { createHash } from 'crypto';

const BOT_UA_RE =
  /googlebot|bingbot|bingpreview|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|applebot|yandexbot|baiduspider|duckduckbot|semrushbot|ahrefsbot|mj12bot|dotbot|petalsearch|bytespider|gptbot|claudebot|anthropic|chatgpt|curl\/|wget\/|python-requests|python-urllib|httpclient|libwww|scrapy|headlesschrome|phantomjs|puppeteer|playwright|selenium|\bspider\b|\bcrawler\b|\bbot\b/i;

/** True when User-Agent looks like a bot/crawler/automation client. */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  const s = (ua || '').trim();
  if (!s) return false;
  return BOT_UA_RE.test(s);
}

/** First public-looking IP from x-forwarded-for / x-real-ip. */
export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for') || headers.get('x-real-ip') || '';
  let first = forwarded.split(',')[0]?.trim() || '';
  if (!first || first === 'unknown') return null;
  // "[ipv6]:port" or "ipv4:port"
  const bracket = first.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracket) return bracket[1] || null;
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(first)) {
    first = first.replace(/:\d+$/, '');
  }
  return first || null;
}

/**
 * Hex sha256(ip + salt). Returns null when IP or ANALYTICS_IP_SALT is missing
 * so inserts skip ip_hash rather than writing a weak/empty fingerprint.
 */
export function hashAnalyticsIp(
  ip: string | null | undefined,
  salt: string | null | undefined = process.env.ANALYTICS_IP_SALT
): string | null {
  const ipTrim = (ip || '').trim();
  const saltTrim = (salt || '').trim();
  if (!ipTrim || !saltTrim) return null;
  return createHash('sha256').update(`${ipTrim}${saltTrim}`, 'utf8').digest('hex');
}
