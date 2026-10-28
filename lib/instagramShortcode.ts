const IG_SHORTCODE_RE = /^[A-Za-z0-9_-]{5,40}$/;

/** Validate Instagram shortcode for /api/thumbnail-proxy?ig= */
export function isValidInstagramShortcode(code: string): boolean {
  return IG_SHORTCODE_RE.test(String(code || ""));
}

/** Extract shortcode from reel/p/tv Instagram URLs. */
export function extractInstagramShortcode(url: string): string | null {
  if (!url) return null;
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i);
  const code = m?.[1] ?? null;
  if (!code || !isValidInstagramShortcode(code)) return null;
  return code;
}

/** Stable Instagram cover via media redirect (not signed scontent URLs). */
export function instagramThumbnailProxySrc(shortcode: string): string {
  return `/api/thumbnail-proxy?ig=${encodeURIComponent(shortcode)}`;
}
