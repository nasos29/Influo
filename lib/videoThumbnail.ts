// Helper functions for video thumbnail generation
import { resolveYouTubeVideoId as resolveYtId } from "./videoThumbnailYoutube";

export { resolveYouTubeVideoId } from "./videoThumbnailYoutube";

export function getVideoThumbnail(url: string): string | null {
  if (!url) return null;

  const ytId = resolveYtId(url);
  if (ytId) {
    // hqdefault is more reliable than maxresdefault (often 404).
    return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
  }

  // Instagram Reels/Posts/TV - API endpoint for server-side thumbnail fetch
  const instagramRegex = /instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/i;
  if (instagramRegex.test(url)) {
    return `/api/video-thumbnail?url=${encodeURIComponent(url)}`;
  }

  // TikTok - full + short URLs
  const tiktokRegex = /tiktok\.com\/@[\w.-]+\/video\/\d+/i;
  const tiktokShortRegex = /(vm|vt)\.tiktok\.com\/[\w-]+\/?/i;

  if (tiktokRegex.test(url) || tiktokShortRegex.test(url)) {
    return `/api/video-thumbnail?url=${encodeURIComponent(url)}`;
  }

  return null;
}

export function isVideoUrl(url: string): boolean {
  if (!url) return false;
  return /youtube\.com|youtu\.be|tiktok\.com|(vm|vt)\.tiktok\.com|instagram\.com\/reel\//i.test(
    url.toLowerCase()
  );
}

export function isDefinitelyVideo(url: string): boolean {
  if (!url) return false;
  return /youtube\.com|youtu\.be|tiktok\.com|(vm|vt)\.tiktok\.com|instagram\.com\/reel\//i.test(
    url.toLowerCase()
  );
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
    const ig = originalUrl.match(/instagram\.com\/(reel|p|tv)\/([A-Za-z0-9_-]+)/i);
    if (!ig?.[1] || !ig?.[2]) return null;
    return `https://www.instagram.com/${ig[1].toLowerCase()}/${ig[2]}/embed`;
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
export function getIframelyEmbedUrl(originalUrl: string, _apiKey?: string): string {
  if (!originalUrl) return "";
  const official = buildOfficialEmbedUrl(originalUrl, { autoplay: false });
  if (official) return official;
  return `/api/video-embed?url=${encodeURIComponent(originalUrl)}`;
}
