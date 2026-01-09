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

