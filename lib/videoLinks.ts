/** Inline copy for Facebook portfolio-link rejection (no translation files). */
export const FACEBOOK_VIDEO_LINK_ERROR = {
  el: "Τα βίντεο από Facebook δεν μπορούν να προβληθούν. Βάλε link από Instagram, TikTok ή YouTube.",
  en: "Facebook videos can't be played. Please use an Instagram, TikTok or YouTube link.",
} as const;

export type CleanVideoLinkResult =
  | { ok: true; url: string }
  | { ok: false; reason: "empty" | "facebook" };

const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"']+/i;
const BARE_URL_RE =
  /(?:^|\s)((?:www\.)?(?:facebook\.com|fb\.watch|fb\.com|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|vm\.tiktok\.com|vt\.tiktok\.com)\/[^\s<>"']*)/i;

/** Strip trailing punctuation often pasted with links. */
function trimUrlJunk(url: string): string {
  return String(url || "").replace(/[.,;:!?)\]}>]+$/g, "");
}

/** First http(s) URL in text, or first known social bare URL. */
export function extractFirstUrl(raw: string): string | null {
  const text = String(raw || "").trim();
  if (!text) return null;

  const withProto = text.match(URL_IN_TEXT_RE);
  if (withProto?.[0]) return trimUrlJunk(withProto[0]);

  const bare = text.match(BARE_URL_RE);
  if (bare?.[1]) return trimUrlJunk(bare[1]);

  // Single token that looks like a host/path (no spaces).
  if (!/\s/.test(text) && /\.[a-z]{2,}/i.test(text)) {
    return trimUrlJunk(text);
  }
  return null;
}

export function ensureHttps(url: string): string {
  const s = String(url || "").trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

/** True for facebook.com, m.facebook.com, fb.com, fb.watch (and www). */
export function isFacebookVideoUrl(url: string): boolean {
  const raw = String(url || "").trim();
  if (!raw) return false;
  try {
    const host = new URL(ensureHttps(raw)).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "facebook.com" || host.endsWith(".facebook.com")) return true;
    if (host === "fb.com" || host.endsWith(".fb.com")) return true;
    if (host === "fb.watch" || host.endsWith(".fb.watch")) return true;
    return false;
  } catch {
    return /(?:^|[/.])(?:facebook\.com|fb\.com|fb\.watch)(?:[/?#:]|$)/i.test(raw);
  }
}

/**
 * Clean a pasted video link before save:
 * - keep only the first URL if extra text was pasted
 * - add https:// when missing
 * - reject Facebook hosts
 */
export function cleanVideoLink(raw: string): CleanVideoLinkResult {
  const text = String(raw || "").trim();
  if (!text) return { ok: false, reason: "empty" };

  const extracted = extractFirstUrl(text);
  if (!extracted) return { ok: false, reason: "empty" };

  const url = ensureHttps(extracted);
  if (isFacebookVideoUrl(url)) return { ok: false, reason: "facebook" };
  return { ok: true, url };
}

export type PrepareVideosResult =
  | { ok: true; videos: string[] }
  | { ok: false; reason: "facebook" };

/** Clean a list of video fields for persistence (skips blanks; fails on Facebook). */
export function prepareVideosForSave(videos: unknown): PrepareVideosResult {
  if (!Array.isArray(videos)) return { ok: true, videos: [] };
  const out: string[] = [];
  for (const item of videos) {
    const raw = typeof item === "string" ? item : String(item ?? "");
    if (!raw.trim()) continue;
    const cleaned = cleanVideoLink(raw);
    if (!cleaned.ok) {
      if (cleaned.reason === "facebook") return { ok: false, reason: "facebook" };
      continue;
    }
    out.push(cleaned.url);
  }
  return { ok: true, videos: out };
}
