/** Allowlisted host suffixes for /api/thumbnail-proxy (exact or subdomain). */
export const ALLOWED_THUMBNAIL_HOST_SUFFIXES = [
  "cdninstagram.com",
  "fbcdn.net",
  "instagram.com",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokcdn-eu.com",
  "ttwstatic.com",
  "ibytedtos.com",
  "img.youtube.com",
  "i.ytimg.com",
] as const;

/**
 * True when hostname is an exact allowlisted suffix or a subdomain of one.
 * Rejects lookalikes like evil-tiktokcdn-eu.com.attacker.net.
 */
export function isAllowedThumbnailHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ALLOWED_THUMBNAIL_HOST_SUFFIXES.some((d) => h === d || h.endsWith(`.${d}`));
}
