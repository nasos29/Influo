/**
 * Pure helpers for video thumbnail extraction / validation (shared by API + tests).
 */

/** Reject generic platform logos that are useless as video covers. */
export function isGenericLogoThumbnail(url: string): boolean {
  if (!url) return true;
  const u = url.toLowerCase();
  return (
    u.includes("tiktok-logo") ||
    u.includes("/static/images/") ||
    u.includes("logo.png")
  );
}

/** Decode JSON string escapes like \\u002F → / */
export function decodeJsonEscapedUrl(raw: string): string {
  return raw
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    )
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"');
}

function normalizeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const full = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  if (!/^https?:\/\//i.test(full)) return null;
  return full;
}

/**
 * First usable "cover" URL from TikTok page HTML / embedded JSON.
 * Decodes \\u002F etc. Rejects generic logos.
 */
export function extractTikTokCoverFromHtml(html: string): string | null {
  if (!html) return null;
  const re = /"cover"\s*:\s*"((?:[^"\\]|\\.)+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const decoded = decodeJsonEscapedUrl(match[1]);
    const url = normalizeHttpUrl(decoded);
    if (url && !isGenericLogoThumbnail(url)) return url;
  }
  return null;
}

/** Extract og:image from HTML meta tags. */
export function extractOgImageFromHtml(html: string): string | null {
  if (!html) return null;
  const patterns = [
    /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const url = normalizeHttpUrl(match[1]);
      if (url && !isGenericLogoThumbnail(url)) return url;
    }
  }
  return null;
}

/** Hosts that browsers often block for hotlinking — route via /api/thumbnail-proxy. */
export function isCdnThumbnailUrl(url: string): boolean {
  return /tiktokcdn|cdninstagram|fbcdn|scontent\.|ibytedtos\.com/i.test(url);
}

export function thumbnailProxySrc(imageUrl: string): string {
  return `/api/thumbnail-proxy?url=${encodeURIComponent(imageUrl)}`;
}

/** Wrap CDN thumbs in the proxy path; leave YouTube / already-proxied alone. */
export function toDisplayThumbnailSrc(thumbnailUrl: string | null): string | null {
  if (!thumbnailUrl) return null;
  if (thumbnailUrl.startsWith("/api/thumbnail-proxy")) return thumbnailUrl;
  if (isCdnThumbnailUrl(thumbnailUrl)) return thumbnailProxySrc(thumbnailUrl);
  return thumbnailUrl;
}
