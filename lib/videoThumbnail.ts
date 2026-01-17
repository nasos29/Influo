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

// Helper to generate Iframely embed URL
// Iframely format: https://iframe.ly/api/iframe?url={original_url}
// Or with API key: https://iframe.ly/api/iframe?url={original_url}&api_key={api_key}
export function getIframelyEmbedUrl(originalUrl: string, apiKey?: string): string {
  if (!originalUrl) return '';
  
  const baseUrl = 'https://iframe.ly/api/iframe';
  const params = new URLSearchParams({
    url: originalUrl,
  });
  
  // Use provided API key, or try to get from environment variable
  // For client-side, use NEXT_PUBLIC_IFRAMELY_API_KEY
  // Fallback to default API key if not provided
  let iframelyApiKey = apiKey;
  
  if (!iframelyApiKey) {
    // Try to get from public env var (available on client-side)
    if (typeof window !== 'undefined') {
      iframelyApiKey = process.env.NEXT_PUBLIC_IFRAMELY_API_KEY || '4355c593a3b2439820d35f';
    } else {
      // Server-side: use server env var or fallback
      iframelyApiKey = process.env.IFRAMELY_API_KEY || '4355c593a3b2439820d35f';
    }
  }
  
  if (iframelyApiKey) {
    params.append('api_key', iframelyApiKey);
  }
  
  return `${baseUrl}?${params.toString()}`;
}
