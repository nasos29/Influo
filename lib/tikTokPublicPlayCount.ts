/**
 * Public TikTok view count from page HTML (__UNIVERSAL_DATA_FOR_REHYDRATION__).
 * Returns null when blocked, missing data, or parse failure — never estimates.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MAX_REDIRECT_HOPS = 6;

function stripUrlNoise(url: string): string {
  return url.split("?")[0].split("#")[0].trim();
}

function isShortTikTokUrl(url: string): boolean {
  return /(vm|vt)\.tiktok\.com\/[\w-]+|tiktok\.com\/t\/[\w-]+/i.test(url);
}

/** Parse itemStruct.stats.playCount from TikTok rehydration JSON embedded in HTML. */
export function parseTikTokPlayCountFromHtml(html: string): number | null {
  if (!html?.trim()) return null;

  let jsonText: string | null = null;
  const scriptMatch = html.match(
    /id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>\s*([\s\S]*?)\s*<\/script>/i
  );
  if (scriptMatch?.[1]) {
    jsonText = scriptMatch[1].trim();
  } else {
    const inline = html.match(/window\.__UNIVERSAL_DATA_FOR_REHYDRATION__\s*=\s*(\{[\s\S]*?\});/);
    if (inline?.[1]) jsonText = inline[1].trim();
  }
  if (!jsonText) return null;

  let root: unknown;
  try {
    root = JSON.parse(jsonText);
  } catch {
    return null;
  }
  if (!root || typeof root !== "object") return null;

  const scope = (root as { __DEFAULT_SCOPE__?: unknown }).__DEFAULT_SCOPE__;
  if (!scope || typeof scope !== "object") return null;

  const videoDetail = (scope as Record<string, unknown>)["webapp.video-detail"];
  if (!videoDetail || typeof videoDetail !== "object") return null;

  const itemInfo = (videoDetail as { itemInfo?: unknown }).itemInfo;
  if (!itemInfo || typeof itemInfo !== "object") return null;

  const itemStruct = (itemInfo as { itemStruct?: unknown }).itemStruct;
  if (!itemStruct || typeof itemStruct !== "object") return null;

  const stats = (itemStruct as { stats?: unknown }).stats;
  if (!stats || typeof stats !== "object") return null;

  const playCount = (stats as { playCount?: unknown }).playCount;
  if (typeof playCount !== "number" || !Number.isFinite(playCount)) return null;
  const n = Math.floor(playCount);
  if (n < 0 || n !== playCount) return null;
  return n;
}

async function resolveTikTokPublicUrl(url: string): Promise<string> {
  const clean = stripUrlNoise(url.trim());
  if (!clean) return clean;
  if (!isShortTikTokUrl(clean)) return clean;

  try {
    let current = clean;
    for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
      const res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": BROWSER_UA },
      });
      try {
        await res.body?.cancel?.();
      } catch {
        /* ignore */
      }
      const loc = res.headers.get("location");
      if (!(res.status >= 300 && res.status < 400) || !loc) break;
      current = new URL(loc, current).href;
    }
    return current;
  } catch {
    return clean;
  }
}

async function fetchTikTokPageHtml(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.length > 500 ? text : null;
  } catch {
    return null;
  }
}

/** Fetch public playCount for a TikTok video URL; null on any failure. */
export async function fetchTikTokPublicPlayCount(sourceUrl: string): Promise<number | null> {
  const trimmed = sourceUrl.trim();
  if (!trimmed || !/tiktok\.com|vm\.tiktok|vt\.tiktok/i.test(trimmed)) return null;
  const resolved = await resolveTikTokPublicUrl(trimmed);
  const html = await fetchTikTokPageHtml(resolved);
  if (!html) return null;
  return parseTikTokPlayCountFromHtml(html);
}