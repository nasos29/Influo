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
 * Prefers cover, then share/origin/reflow. Decodes \\u002F etc. Rejects logos.
 */
export function extractTikTokCoverFromHtml(html: string): string | null {
  if (!html) return null;
  const keys = [
    "cover",
    "shareCover",
    "originCover",
    "reflowCover",
    "dynamicCover",
  ];
  for (const key of keys) {
    const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)+)"`, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      const decoded = decodeJsonEscapedUrl(match[1]);
      const url = normalizeHttpUrl(decoded);
      if (url && !isGenericLogoThumbnail(url)) return url;
    }
  }
  return null;
}

/** True when TikTok HTML/JSON indicates a photo / slideshow post. */
export function tikTokHtmlIndicatesPhotoPost(html: string): boolean {
  if (!html) return false;
  if (/\/@[\w.-]+\/photo\/\d+/i.test(html)) return true;
  if (/"imagePost"\s*:/.test(html) || /\\"imagePost\\"\s*:/.test(html)) {
    return true;
  }
  if (/"image_post_info"\s*:/.test(html) || /\\"image_post_info\\"\s*:/.test(html)) {
    return true;
  }
  // Photo posts sometimes resolve to /video/{id} with empty playable stream.
  if (
    /"playAddr"\s*:\s*""/.test(html) ||
    /"playAddr"\s*:\s*null/.test(html) ||
    /\\"playAddr\\"\s*:\s*\\"\\"/.test(html) ||
    /\\"playAddr\\"\s*:\s*null/.test(html)
  ) {
    return true;
  }
  return false;
}

/** First image URL from TikTok imagePost.images[].imageURL.urlList[0] style blobs. */
export function extractTikTokImagePostCover(html: string): string | null {
  if (!html) return null;
  const idx = html.search(/imagePost|image_post_info/i);
  if (idx < 0) return null;
  const slice = html.slice(idx, idx + 40_000);
  const patterns = [
    /"urlList"\s*:\s*\[\s*"(https:[^"]+)"/,
    /\\"urlList\\"\s*:\s*\[\s*\\"(https:[^"\\]+)\\"/,
    /"url"\s*:\s*"(https:[^"]+(?:tiktokcdn|ttwstatic)[^"]*)"/i,
  ];
  for (const re of patterns) {
    const m = slice.match(re);
    if (!m?.[1]) continue;
    const url = normalizeHttpUrl(decodeJsonEscapedUrl(m[1]));
    if (url && !isGenericLogoThumbnail(url)) return url;
  }
  return null;
}

/**
 * Heuristic: mostly-black JPEG/PNG (avg luminance below threshold).
 * Used to invalidate bad TikTok covers on ?refresh=1.
 */
export function isNearBlackImageBuffer(
  buf: ArrayBuffer | Uint8Array,
  opts?: { sample?: number; maxAvg?: number }
): boolean {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (bytes.length < 100) return true;
  const sample = opts?.sample ?? 2000;
  const maxAvg = opts?.maxAvg ?? 18;
  const step = Math.max(1, Math.floor(bytes.length / sample));
  let sum = 0;
  let n = 0;
  for (let i = 0; i < bytes.length && n < sample; i += step) {
    sum += bytes[i]!;
    n++;
  }
  return n > 0 && sum / n < maxAvg;
}

/** Decode common HTML entities in meta content URLs (`&amp;` → `&`). */
function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
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
      const url = normalizeHttpUrl(decodeHtmlEntities(match[1]));
      if (url && !isGenericLogoThumbnail(url)) return url;
    }
  }
  return null;
}

/** Hosts that browsers often block for hotlinking — route via /api/thumbnail-proxy. */
export function isCdnThumbnailUrl(url: string): boolean {
  return /tiktokcdn|ttwstatic\.com|cdninstagram|fbcdn|scontent\.|ibytedtos\.com/i.test(url);
}

export function thumbnailProxySrc(imageUrl: string): string {
  return `/api/thumbnail-proxy?url=${encodeURIComponent(imageUrl)}`;
}

/** Wrap CDN thumbs in the proxy path; Storage via image-proxy; leave YouTube alone. */
export function toDisplayThumbnailSrc(thumbnailUrl: string | null): string | null {
  if (!thumbnailUrl) return null;
  if (thumbnailUrl.startsWith("/api/thumbnail-proxy")) return thumbnailUrl;
  if (thumbnailUrl.startsWith("/api/image-proxy")) return thumbnailUrl;
  if (isCdnThumbnailUrl(thumbnailUrl)) return thumbnailProxySrc(thumbnailUrl);
  // Durable covers in Supabase Storage → Vercel CDN via /api/image-proxy
  if (
    (thumbnailUrl.includes("supabase.co") || thumbnailUrl.includes("supabase.in")) &&
    thumbnailUrl.includes("/storage/")
  ) {
    return `/api/image-proxy?url=${encodeURIComponent(thumbnailUrl)}`;
  }
  return thumbnailUrl;
}
