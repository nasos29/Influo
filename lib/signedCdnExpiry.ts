/**
 * Parse signed CDN URL expiry (TikTok x-expires, Instagram oe).
 * Returns expiry time in epoch milliseconds, or null if unknown.
 */

function parseQueryParam(url: string, key: string): string | null {
  try {
    const u = new URL(url);
    const v = u.searchParams.get(key);
    if (v) return v;
  } catch {
    /* fall through to regex */
  }
  const re = new RegExp(`[?&]${key}=([^&]+)`, "i");
  const m = url.match(re);
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

/**
 * TikTok CDN uses `x-expires=<unix seconds>`.
 * Instagram / Facebook CDN uses `oe=<hex unix seconds>`.
 */
export function getSignedUrlExpiryMs(url: string): number | null {
  if (!url || typeof url !== "string") return null;

  const xExpires = parseQueryParam(url, "x-expires");
  if (xExpires) {
    const sec = Number.parseInt(xExpires, 10);
    if (Number.isFinite(sec) && sec > 0) return sec * 1000;
  }

  const oe = parseQueryParam(url, "oe");
  if (oe) {
    const hex = oe.trim();
    if (/^[0-9a-fA-F]+$/.test(hex)) {
      const sec = Number.parseInt(hex, 16);
      if (Number.isFinite(sec) && sec > 0) return sec * 1000;
    }
  }

  return null;
}

/** True when the signed URL is already expired or expires within `skewMs` (default 1h). */
export function isSignedUrlStale(url: string, skewMs = 60 * 60 * 1000, now = Date.now()): boolean {
  const exp = getSignedUrlExpiryMs(url);
  if (exp == null) return false;
  return exp - now < skewMs;
}
