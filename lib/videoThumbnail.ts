// Helper functions for video thumbnail generation

export function getVideoThumbnail(url: string): string | null {
  if (!url) return null;

  // YouTube
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) {
    return `https://img.youtube.com/vi/${youtubeMatch[1]}/maxresdefault.jpg`;
  }

  // TikTok (no public API, but we can try to extract video ID)
  // TikTok URLs are like: https://www.tiktok.com/@username/video/1234567890
  // Unfortunately, TikTok doesn't provide public thumbnail API, so we return null
  
  // Instagram Reels (no public API)
  
  return null;
}

export function isVideoUrl(url: string): boolean {
  if (!url) return false;
  return /youtube\.com|youtu\.be|tiktok\.com|instagram\.com.*reel|vimeo\.com/.test(url.toLowerCase());
}

export function extractVideoId(url: string): string | null {
  // YouTube
  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) return youtubeMatch[1];
  
  return null;
}

