// Helper functions for video thumbnail generation
import { resolveYouTubeVideoId as resolveYtId } from "./videoThumbnailYoutube";
import { extractInstagramMedia } from "./instagramShortcode";
import { extractTikTokVideoId, isTikTokShortLink } from "./tikTokPlayer";

export { resolveYouTubeVideoId } from "./videoThumbnailYoutube";
export { buildTikTokPlayerUrl, extractTikTokVideoId, isTikTokShortLink } from "./tikTokPlayer";
export {
  extractInstagramMedia,
  extractInstagramShortcode,
  isValidInstagramShortcode,
  instagramThumbnailProxySrc,
} from "./instagramShortcode";

const IG_MEDIA_RE =
  /instagram\.com\/(?:(?:[A-Za-z0-9._]+)\/)?(p|reel|tv)\/([A-Za-z0-9_-]+)/i;
const TT_VIDEO_RE = /tiktok\.com\/@[\w.-]+\/(?:video|photo)\/\d+/i;

export function getVideoThumbnail(url: string): string | null {
  if (!url) return null;

  const ytId = resolveYtId(url);
  if (ytId) {
    // hqdefault is more reliable than maxresdefault (often 404).
    return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  }

  // Instagram Reels/Posts/TV (optional username segment)
  if (IG_MEDIA_RE.test(url)) {
    return `/api/video-thumbnail?url=${encodeURIComponent(url)}`;
  }

  // TikTok - full + short URLs (vm/vt + /t/)
  if (TT_VIDEO_RE.test(url) || isTikTokShortLink(url)) {
    return `/api/video-thumbnail?url=${encodeURIComponent(url)}`;
  }

  return null;
}

/**
 * True when the URL is a specific social video/post that can be embedded
 * (not a profile, channel, stories/highlights, etc.).
 */
export function isEmbeddableVideoUrl(url: string): boolean {
  if (!url?.trim()) return false;
  const clean = url.trim();

  if (resolveYtId(clean)) return true;
  if (extractInstagramMedia(clean)) return true;
  if (TT_VIDEO_RE.test(clean)) return true;
  if (isTikTokShortLink(clean)) return true;
  // Already-resolved numeric TikTok paths without @user
  if (/tiktok\.com\/(?:video|photo)\/\d+/i.test(clean)) return true;
  if (extractTikTokVideoId(clean) && /tiktok\.com\/(?:embed|player)\//i.test(clean)) {
    return true;
  }
  return false;
}

export function isVideoUrl(url: string): boolean {
  return isEmbeddableVideoUrl(url);
}

export function isDefinitelyVideo(url: string): boolean {
  return isEmbeddableVideoUrl(url);
}

export function isDefinitelyImage(url: string): boolean {
  if (!url) return false;
  return (
    /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url) ||
    /^https?:\/\/.*\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(url)
  );
}

export function extractVideoId(url: string): string | null {
  return resolveYtId(url);
}

/**
 * Deterministic official embed URL for Instagram / YouTube (no API call).
 * TikTok short links need /api/video-embed resolution — returns null.
 */
export function buildOfficialEmbedUrl(
  originalUrl: string,
  opts?: { autoplay?: boolean }
): string | null {
  if (!originalUrl) return null;
  const provider = detectProvider(originalUrl);
  if (provider === "instagram") {
    const ig = extractInstagramMedia(originalUrl);
    if (!ig) return null;
    return `https://www.instagram.com/${ig.kind}/${ig.code}/embed`;
  }
  if (provider === "youtube") {
    const id = resolveYtId(originalUrl);
    if (!id) return null;
    const params = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
    });
    if (opts?.autoplay) params.set("autoplay", "1");
    return `https://www.youtube.com/embed/${id}?${params.toString()}`;
  }
  return null;
}

export function detectProvider(url: string): "instagram" | "tiktok" | "youtube" | null {
  if (!url) return null;

  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be")) {
    return "youtube";
  }

  if (lowerUrl.includes("instagram.com")) {
    return "instagram";
  }

  if (
    lowerUrl.includes("tiktok.com") ||
    lowerUrl.includes("vm.tiktok.com") ||
    lowerUrl.includes("vt.tiktok.com")
  ) {
    return "tiktok";
  }

  return null;
}

/**
 * Preferred embed source for a social URL.
 * Instagram/YouTube → official embed (deterministic). TikTok → /api/video-embed.
 */
export function getVideoEmbedApiUrl(originalUrl: string): string {
  if (!originalUrl) return "";
  const official = buildOfficialEmbedUrl(originalUrl, { autoplay: false });
  if (official) return official;
  return `/api/video-embed?url=${encodeURIComponent(originalUrl)}`;
}
