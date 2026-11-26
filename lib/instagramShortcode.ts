const IG_SHORTCODE_RE = /^[A-Za-z0-9_-]{5,40}$/;

/** Validate Instagram shortcode for /api/thumbnail-proxy?ig= */
export function isValidInstagramShortcode(code: string): boolean {
  return IG_SHORTCODE_RE.test(String(code || ""));
}

/**
 * Match Instagram media URLs:
 * - instagram.com/{p|reel|tv}/{code}
 * - instagram.com/{username}/{p|reel|tv}/{code}
 */
const IG_MEDIA_RE =
  /instagram\.com\/(?:(?:[A-Za-z0-9._]+)\/)?(p|reel|tv)\/([A-Za-z0-9_-]+)/i;

export type InstagramMediaRef = {
  kind: "p" | "reel" | "tv";
  code: string;
};

/** Extract kind + shortcode from Instagram reel/p/tv URLs (optional username segment). */
export function extractInstagramMedia(url: string): InstagramMediaRef | null {
  if (!url) return null;
  const m = url.match(IG_MEDIA_RE);
  if (!m?.[1] || !m?.[2]) return null;
  const kind = m[1].toLowerCase() as InstagramMediaRef["kind"];
  const code = m[2];
  if (!isValidInstagramShortcode(code)) return null;
  return { kind, code };
}

/** Extract shortcode from reel/p/tv Instagram URLs. */
export function extractInstagramShortcode(url: string): string | null {
  return extractInstagramMedia(url)?.code ?? null;
}

const IG_SHARE_PATH_RE = /^\/share(?:\/(p|reel|tv))?\/([A-Za-z0-9_-]+)\/?$/i;

/** True for Instagram mobile share links (https + /share/...). */
export function isInstagramSharePathUrl(url: string): boolean {
  const raw = String(url || "").trim();
  if (!raw) return false;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host !== "instagram.com" && !host.endsWith(".instagram.com") && host !== "instagr.am") {
      return false;
    }
    const m = u.pathname.match(IG_SHARE_PATH_RE);
    if (!m?.[2]) return false;
    return isValidInstagramShortcode(m[2]);
  } catch {
    return false;
  }
}

/** Stable Instagram cover via media redirect (not signed scontent URLs). */
export function instagramThumbnailProxySrc(shortcode: string): string {
  return `/api/thumbnail-proxy?ig=${encodeURIComponent(shortcode)}`;
}
