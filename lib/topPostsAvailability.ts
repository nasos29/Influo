/**
 * Server-side: detect top posts that Instagram/TikTok/YouTube no longer serve
 * (removed, private, or not embeddable) so they are not saved or shown.
 * Only a clear "missing" / "unplayable" drops a post; unknown keeps it.
 */
import { checkPortfolioLinkStatus } from "@/lib/checkPortfolioVideos";
import { isAllowedTopPostUrl } from "@/lib/topPosts";

const PER_URL_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { unavailable: boolean; at: number }>();

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

/**
 * Instagram can answer 200 on the permalink/oEmbed while its embed renders the
 * "link may be broken, or the post may have been removed" card (class EmbedBrokenMedia).
 * Returns true (broken), false (media present) or null (could not tell).
 */
export async function instagramEmbedBroken(url: string): Promise<boolean | null> {
  const m = url.match(/instagram\.com\/(?:[^/]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
  if (!m) return null;
  const kind = m[1].toLowerCase() === "reels" ? "reel" : m[1].toLowerCase();
  try {
    const res = await fetch(`https://www.instagram.com/${kind}/${m[2]}/embed/captioned/`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      redirect: "follow",
      signal: AbortSignal.timeout(PER_URL_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (/EmbedBrokenMedia/.test(html)) return true;
    if (/EmbeddedMediaImage|data-media-type|EmbedVideo/.test(html)) return false;
    return null;
  } catch {
    return null;
  }
}

/** True only when the post is clearly gone or not playable. Never throws. */
export async function isTopPostUnavailable(url: string): Promise<boolean> {
  if (!isAllowedTopPostUrl(url)) return true;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.unavailable;
  try {
    if (/instagram\.com/i.test(url) && (await instagramEmbedBroken(url)) === true) {
      cache.set(url, { unavailable: true, at: Date.now() });
      return true;
    }
    const res = await withTimeout(checkPortfolioLinkStatus(url), PER_URL_TIMEOUT_MS);
    if (!res || res.status === "unknown") return false; // do not cache unknowns
    const unavailable = res.status === "missing" || res.status === "unplayable";
    cache.set(url, { unavailable, at: Date.now() });
    if (cache.size > 5000) cache.delete(cache.keys().next().value as string);
    return unavailable;
  } catch {
    return false;
  }
}

export async function unavailableTopPostUrls(urls: string[]): Promise<string[]> {
  const results = await Promise.all(urls.map(async (u) => ((await isTopPostUnavailable(u)) ? u : null)));
  return results.filter((u): u is string => !!u);
}

/** Drop unavailable posts before saving. Keeps order. Never throws. */
export async function filterAvailableTopPosts<T extends { url: string }>(posts: T[]): Promise<T[]> {
  if (!posts.length) return posts;
  try {
    const bad = new Set(await unavailableTopPostUrls(posts.map((p) => p.url)));
    if (bad.size) console.log("[top posts] dropped unavailable", bad.size);
    return posts.filter((p) => !bad.has(p.url));
  } catch {
    return posts;
  }
}
