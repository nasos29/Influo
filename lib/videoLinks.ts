import { detectMediaPlatform } from "@/lib/creatorMedia";
import { isPortfolioStillImageUrl, isSelfHostedPortfolioUrl } from "@/lib/portfolioHosted";
import { isInstagramShareUrl, resolveInstagramShareUrl } from "@/lib/resolveInstagramShareUrl";
import type { ShareResolveFetch } from "@/lib/resolveInstagramShareUrl";

/** Inline copy for Facebook portfolio-link rejection (no translation files). */
export const FACEBOOK_VIDEO_LINK_ERROR = {
  el: "Τα βίντεο από Facebook δεν μπορούν να προβληθούν. Βάλε link από Instagram, TikTok ή YouTube.",
  en: "Facebook videos can't be played. Please use an Instagram, TikTok or YouTube link.",
} as const;

/** Reject Canva, Drive, profile pages, etc. — suggest direct upload. */
export const UNSUPPORTED_VIDEO_LINK_ERROR = {
  el: "Δεκτά είναι μόνο links από TikTok, Instagram ή YouTube, ή αρχείο που ανεβάζεις απευθείας εδώ. Για άλλες σελίδες (Canva, Google Drive κ.λπ.) πάτα «Ανέβασμα αρχείου».",
  en: "Only TikTok, Instagram, or YouTube links are allowed, or a file you upload here. For other sites (Canva, Google Drive, etc.) use “Upload file”.",
} as const;

export type PortfolioLinkRejectReason = "facebook" | "unsupported";

export function portfolioLinkValidationError(reason: PortfolioLinkRejectReason, lang: "el" | "en"): string {
  return reason === "facebook" ? FACEBOOK_VIDEO_LINK_ERROR[lang] : UNSUPPORTED_VIDEO_LINK_ERROR[lang];
}

export type CleanVideoLinkResult =
  | { ok: true; url: string }
  | { ok: false; reason: "empty" | PortfolioLinkRejectReason };

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
/** Portfolio save/display: TikTok, Instagram, YouTube, or our own hosted portfolio URLs only. */
export function isAllowedPortfolioUrl(url: string | null | undefined): boolean {
  const raw = String(url || "").trim();
  if (!raw) return false;
  const u = ensureHttps(raw);
  if (isSelfHostedPortfolioUrl(u)) return true;
  if (isPortfolioStillImageUrl(u)) return false;
  if (isFacebookVideoUrl(u)) return false;
  const platform = detectMediaPlatform(u);
  return platform === "tiktok" || platform === "instagram" || platform === "youtube";
}

/** Drop empty / unsupported entries before public profile, directory, or media kit. */
export function filterPublicPortfolioVideos(videos: unknown): string[] {
  if (!Array.isArray(videos)) return [];
  const out: string[] = [];
  for (const item of videos) {
    const raw = typeof item === "string" ? item.trim() : "";
    if (!raw) continue;
    if (!isAllowedPortfolioUrl(raw)) continue;
    out.push(raw);
  }
  return out;
}

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
  if (!isAllowedPortfolioUrl(url)) return { ok: false, reason: "unsupported" };
  return { ok: true, url };
}

export type PrepareVideosResult =
  | { ok: true; videos: string[] }
  | { ok: false; reason: PortfolioLinkRejectReason };

/** Clean a list of video fields for persistence (skips blanks; fails on Facebook). */
export function prepareVideosForSave(videos: unknown): PrepareVideosResult {
  if (!Array.isArray(videos)) return { ok: true, videos: [] };
  const out: string[] = [];
  for (const item of videos) {
    const raw = typeof item === "string" ? item : String(item ?? "");
    if (!raw.trim()) continue;
    const cleaned = cleanVideoLink(raw);
    if (!cleaned.ok) {
      if (cleaned.reason === "facebook" || cleaned.reason === "unsupported") {
        return { ok: false, reason: cleaned.reason };
      }
      continue;
    }
    out.push(cleaned.url);
  }
  return { ok: true, videos: out };
}

export type PrepareVideosAsyncResult =
  | { ok: true; videos: string[] }
  | { ok: false; reason: PortfolioLinkRejectReason | "instagram_share_unresolved" };

/** Like prepareVideosForSave but canonicalizes Instagram share links when saving server-side. */
export async function prepareVideosForSaveAsync(
  videos: unknown,
  fetchImpl?: ShareResolveFetch
): Promise<PrepareVideosAsyncResult> {
  const base = prepareVideosForSave(videos);
  if (!base.ok) return base;

  const out: string[] = [];
  for (const link of base.videos) {
    if (isInstagramShareUrl(link)) {
      const resolved = await resolveInstagramShareUrl(link, fetchImpl);
      if (!resolved.ok) return { ok: false, reason: "instagram_share_unresolved" };
      out.push(resolved.url);
    } else {
      out.push(link);
    }
  }
  return { ok: true, videos: out };
}

/** Free plan: max portfolio items per creator (videos and photos combined). Older profiles above it keep theirs but cannot add more. */
export const MAX_PORTFOLIO_POSTS = 6;

/** Allowed count given what was already saved (grandfathers older profiles with more). */
export function portfolioPostLimit(existingCount = 0): number {
  return Math.max(MAX_PORTFOLIO_POSTS, existingCount);
}

export function portfolioLimitMessage(lang: "el" | "en"): string {
  return lang === "en"
    ? `You can add up to ${MAX_PORTFOLIO_POSTS} portfolio items (videos and photos in total).`
    : `Μπορείτε να προσθέσετε έως ${MAX_PORTFOLIO_POSTS} στοιχεία στο portfolio (βίντεο και φωτογραφίες συνολικά).`;
}
