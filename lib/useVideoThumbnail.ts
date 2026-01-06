import { useState, useEffect } from 'react';

// Hook to fetch video thumbnail, especially for Instagram
export function useVideoThumbnail(url: string | null): string | null {
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setThumbnail(null);
      return;
    }

    // If it's a YouTube URL, use direct thumbnail
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch) {
      setThumbnail(`https://img.youtube.com/vi/${youtubeMatch[1]}/maxresdefault.jpg`);
      return;
    }

    // If it's an Instagram URL, fetch from API
    const instagramRegex = /instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/;
    if (instagramRegex.test(url)) {
      // Check if it's an API URL (already fetched)
      if (url.startsWith('/api/video-thumbnail')) {
        // Extract the actual Instagram URL from the API URL
        const urlParam = new URLSearchParams(url.split('?')[1]).get('url');
        if (urlParam) {
          fetch(`/api/video-thumbnail?url=${encodeURIComponent(urlParam)}`)
            .then(res => res.json())
            .then(data => {
              if (data.thumbnail) {
                setThumbnail(data.thumbnail);
              }
            })
            .catch(err => {
              console.error('Error fetching Instagram thumbnail:', err);
            });
        }
      } else {
        // Direct Instagram URL, fetch thumbnail
        fetch(`/api/video-thumbnail?url=${encodeURIComponent(url)}`)
          .then(res => res.json())
          .then(data => {
            if (data.thumbnail) {
              setThumbnail(data.thumbnail);
            }
          })
          .catch(err => {
            console.error('Error fetching Instagram thumbnail:', err);
          });
      }
      return;
    }

    // For other URLs or if it's already an image URL, use it directly
    setThumbnail(url);
  }, [url]);

  return thumbnail;
}

