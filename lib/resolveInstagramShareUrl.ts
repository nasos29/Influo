/**
 * Resolve Instagram mobile "share" links to canonical /p|reel|tv/{shortcode}/ URLs.
 * SSRF-safe: follows redirects only to Instagram hosts.
 */

import {
  extractInstagramMedia,
  isValidInstagramShortcode,
  type InstagramMediaRef,
} from "@/lib/instagramShortcode";
const ALLOWED_IG_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "m.instagram.com",
  "instagr.am",
  "www.instagr.am",
]);

const SHARE_PATH_RE = /^\/share(?:\/(p|reel|tv))?\/([A-Za-z0-9_-]+)\/?$/i;

const MAX_REDIRECTS = 8;
export const INSTAGRAM_SHARE_RESOLVE_TIMEOUT_MS = 6000;

export const INSTAGRAM_SHARE_MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

export type ResolveInstagramShareResult =
  | { ok: true; url: string; media: InstagramMediaRef }
  | { ok: false; error: string };

export type ShareResolveFetch = typeof fetch;

export function isAllowedInstagramHostname(hostname: string): boolean {
  const host = String(hostname || "")
    .toLowerCase()
    .replace(/\.$/, "");
  if (ALLOWED_IG_HOSTS.has(host)) return true;
  return host.endsWith(".instagram.com") && !host.includes("..");
}

/** True for https Instagram /share/... links (incl. /share/reel|p|tv/TOKEN). */
export function isInstagramShareUrl(raw: string): boolean {
  const url = String(raw || "").trim();
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (!isAllowedInstagramHostname(u.hostname)) return false;
    return SHARE_PATH_RE.test(u.pathname);
  } catch {
    return false;
  }
}

export function canonicalInstagramMediaUrl(
  kind: InstagramMediaRef["kind"],
  code: string
): string {
  return `https://www.instagram.com/${kind}/${code}/`;
}

/** Strip tracking query params; keep only canonical https media URL when already resolved. */
export function normalizeInstagramMediaUrl(raw: string): string | null {
  const media = extractInstagramMedia(raw);
  if (!media) return null;
  return canonicalInstagramMediaUrl(media.kind, media.code);
}

function mediaFromUrlString(url: string): InstagramMediaRef | null {
  const normalized = normalizeInstagramMediaUrl(url);
  if (!normalized) return null;
  return extractInstagramMedia(normalized);
}

function parseOgOrCanonicalFromHtml(html: string): string | null {
  const og = html.match(
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i
  );
  const ogUrl = og?.[1] || html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i
  )?.[1];
  if (ogUrl && mediaFromUrlString(ogUrl)) return normalizeInstagramMediaUrl(ogUrl);
  const link = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i
  );
  const href = link?.[1] || html.match(
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i
  )?.[1];
  if (href && mediaFromUrlString(href)) return normalizeInstagramMediaUrl(href);
  return null;
}

function validateShareInput(raw: string): URL | null {
  const url = String(raw || "").trim();
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (!isAllowedInstagramHostname(u.hostname)) return null;
  const shareMatch = u.pathname.match(SHARE_PATH_RE);
  if (!shareMatch?.[2]) return null;
  const token = shareMatch[2];
  if (!isValidInstagramShortcode(token)) return null;
  return u;
}

function assertRedirectTarget(current: string, location: string): string | null {
  try {
    const next = new URL(location, current);
    if (next.protocol !== "https:") return null;
    if (!isAllowedInstagramHostname(next.hostname)) return null;
    return next.href;
  } catch {
    return null;
  }
}

/**
 * Follow Instagram share redirects and return canonical media URL.
 * Pass `fetchImpl` in tests to mock the network.
 */
export async function resolveInstagramShareUrl(
  raw: string,
  fetchImpl: ShareResolveFetch = fetch
): Promise<ResolveInstagramShareResult> {
  const already = normalizeInstagramMediaUrl(raw);
  if (already) {
    const media = extractInstagramMedia(already);
    if (media) return { ok: true, url: already, media };
  }

  const start = validateShareInput(raw);
  if (!start) {
    return { ok: false, error: "not_instagram_share_url" };
  }

  let current = start.href;

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      let res: Response;
      try {
        res = await fetchImpl(current, {
          method: "GET",
          redirect: "manual",
          signal: AbortSignal.timeout(INSTAGRAM_SHARE_RESOLVE_TIMEOUT_MS),
          headers: {
            "User-Agent": INSTAGRAM_SHARE_MOBILE_UA,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "fetch_failed";
        return { ok: false, error: msg };
      }

      const mediaFromFinal = mediaFromUrlString(res.url || current);
      if (mediaFromFinal) {
        const url = normalizeInstagramMediaUrl(res.url || current)!;
        return { ok: true, url, media: mediaFromFinal };
      }

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        try {
          await res.body?.cancel?.();
        } catch {
          /* ignore */
        }
        if (!location) return { ok: false, error: "redirect_without_location" };
        const next = assertRedirectTarget(current, location);
        if (!next) return { ok: false, error: "redirect_blocked_ssrf" };
        current = next;
        const fromLoc = mediaFromUrlString(current);
        if (fromLoc) {
          const url = normalizeInstagramMediaUrl(current)!;
          return { ok: true, url, media: fromLoc };
        }
        continue;
      }

      const body = await res.text().catch(() => "");
      const fromHtml = parseOgOrCanonicalFromHtml(body);
      if (fromHtml) {
        const media = extractInstagramMedia(fromHtml);
        if (media) return { ok: true, url: fromHtml, media };
      }

      const fromCurrent = mediaFromUrlString(current);
      if (fromCurrent && res.ok) {
        const url = normalizeInstagramMediaUrl(current)!;
        return { ok: true, url, media: fromCurrent };
      }

      return { ok: false, error: `unresolved_share_link_http_${res.status}` };
    }
    return { ok: false, error: "too_many_redirects" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "resolve_failed";
    return { ok: false, error: msg };
  }
}

/** Resolve share links when present; otherwise return input unchanged. */
export async function resolveInstagramPostUrlIfNeeded(
  raw: string,
  fetchImpl?: ShareResolveFetch
): Promise<string> {
  const url = String(raw || "").trim();
  if (!url) return url;
  if (isInstagramShareUrl(url)) {
    const resolved = await resolveInstagramShareUrl(url, fetchImpl);
    if (resolved.ok) return resolved.url;
    return url;
  }
  const normalized = normalizeInstagramMediaUrl(url);
  return normalized || url;
}