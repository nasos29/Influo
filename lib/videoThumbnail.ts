// Helper functions for video thumbnail generation

export function getVideoThumbnail(url: string): string | null {
  if (!url) return null;

  // YouTube
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) {
    return `https://img.youtube.com/vi/${youtubeMatch[1]}/maxresdefault.jpg`;
  }

  // Instagram Reels/Posts - use API endpoint for server-side fetching
  // Client-side will call the API to get thumbnail
  const instagramRegex = /instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/;
  if (instagramRegex.test(url)) {
    // Return a placeholder URL that the component can use to fetch from API
    return `/api/video-thumbnail?url=${encodeURIComponent(url)}`;
  }

  // TikTok (no public API, but we can try to extract video ID)
  // TikTok URLs are like: https://www.tiktok.com/@username/video/1234567890
  // Unfortunately, TikTok doesn't provide public thumbnail API, so we return null
  
  return null;
}

export function isVideoUrl(url: string): boolean {
  if (!url) return false;
  // Check for video platforms - Instagram posts (p/) and reels are considered videos
  return /youtube\.com|youtu\.be|tiktok\.com|instagram\.com\/(?:p|reel)\//i.test(url.toLowerCase());
}

export function extractVideoId(url: string): string | null {
  // YouTube
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) return youtubeMatch[1];
  
  return null;
}

