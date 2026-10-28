// Helper functions for video thumbnail generation

export function getVideoThumbnail(url: string): string | null {
  if (!url) return null;

  // YouTube
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) {
    // hqdefault is more reliable than maxresdefault (often 404).
    return `https://img.youtube.com/vi/${youtubeMatch[1]}/hqdefault.jpg`;
  }

  // Instagram Reels/Posts/TV - API endpoint for server-side thumbnail fetch
  const instagramRegex = /instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/;
  if (instagramRegex.test(url)) {
    return `/api/video-thumbnail?url=${encodeURIComponent(url)}`;
  }

  // TikTok - use API endpoint for server-side fetching
  // TikTok URLs are like: https://www.tiktok.com/@username/video/1234567890
  // Also support short URLs: https://vm.tiktok.com/XXXXX/ or https://vt.tiktok.com/XXXXX/
  // Match with or without query parameters
  const tiktokRegex = /tiktok\.com\/@[\w.-]+\/video\/\d+/i;
  const tiktokShortRegex = /(vm|vt)\.tiktok\.com\/[\w-]+\/?/i;
  
  if (tiktokRegex.test(url) || tiktokShortRegex.test(url)) {
    console.log('getVideoThumbnail: TikTok URL matched:', url);
    // Return a placeholder URL that the component can use to fetch from API
    return `/api/video-thumbnail?url=${encodeURIComponent(url)}`;
  }
  
  return null;
}

export function isVideoUrl(url: string): boolean {
  if (!url) return false;
  // Check for video platforms
  // Instagram reels are always videos, but posts (p/) can be photos or videos
  // For now, only consider reels as videos, not posts
  // Include TikTok short URLs (vm.tiktok.com, vt.tiktok.com)
  return /youtube\.com|youtu\.be|tiktok\.com|(vm|vt)\.tiktok\.com|instagram\.com\/reel\//i.test(url.toLowerCase());
}

// Helper to check if URL is definitely a video (including Instagram reels)
export function isDefinitelyVideo(url: string): boolean {
  if (!url) return false;
  // YouTube, TikTok, Instagram Reels are definitely videos
  return /youtube\.com|youtu\.be|tiktok\.com|(vm|vt)\.tiktok\.com|instagram\.com\/reel\//i.test(url.toLowerCase());
}

// Helper to check if URL is definitely an image
export function isDefinitelyImage(url: string): boolean {
  if (!url) return false;
  // Direct image URLs
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(url) || 
         /^https?:\/\/.*\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i.test(url);
}

export function extractVideoId(url: string): string | null {
  // YouTube
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) return youtubeMatch[1];

  return null;
}

/** Resolve YouTube watch/shorts/youtu.be → 11-char video id. */
export function resolveYouTubeVideoId(url: string): string | null {
  const clean = String(url || "").trim();
  if (!clean) return null;
  const patterns = [
    /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i,
    /[?&]v=([A-Za-z0-9_-]{11})/i,
  ];
  for (const re of patterns) {
    const m = clean.match(re);
    if (m?.[1]) return m[1];
  }
  return extractVideoId(clean);
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
    const id = resolveYouTubeVideoId(originalUrl);
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

// Helper to detect social media provider from URL
export function detectProvider(url: string): "instagram" | "tiktok" | "youtube" | null {
  if (!url) return null;
  
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return 'youtube';
  }
  
  if (lowerUrl.includes('instagram.com')) {
    return 'instagram';
  }
  
  if (lowerUrl.includes('tiktok.com') || lowerUrl.includes('vm.tiktok.com') || lowerUrl.includes('vt.tiktok.com')) {
    return 'tiktok';
  }
  
  return null;
}

/**
 * Preferred embed source for a social URL.
 * Instagram/YouTube → official embed (deterministic). TikTok → /api/video-embed (needs resolve/cache).
 */
export function getIframelyEmbedUrl(originalUrl: string, _apiKey?: string): string {
  if (!originalUrl) return "";
  const official = buildOfficialEmbedUrl(originalUrl, { autoplay: false });
  if (official) return official;
  return `/api/video-embed?url=${encodeURIComponent(originalUrl)}`;
}
