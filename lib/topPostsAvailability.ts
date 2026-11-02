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

/** True only when the post is clearly gone or not playable. Never throws. */
export async function isTopPostUnavailable(url: string): Promise<boolean> {
  if (!isAllowedTopPostUrl(url)) return true;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.unavailable;
  try {
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
