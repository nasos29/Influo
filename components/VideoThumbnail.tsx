"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getVideoThumbnail, isVideoUrl } from '@/lib/videoThumbnail';

interface VideoThumbnailProps {
  url: string;
  alt?: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
}

export default function VideoThumbnail({ 
  url, 
  alt = "Video thumbnail",
  className = "",
  fill = false,
  width,
  height
}: VideoThumbnailProps) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isVideo = isVideoUrl(url);

  useEffect(() => {
    const fetchThumbnail = async () => {
      if (isImage) {
        setThumbnail(url);
        setLoading(false);
        return;
      }

      // Try direct thumbnail (YouTube)
      const directThumbnail = getVideoThumbnail(url);
      if (directThumbnail && !directThumbnail.startsWith('/api/')) {
        setThumbnail(directThumbnail);
        setLoading(false);
        return;
      }

      // For Instagram or other platforms that need API call
      if (directThumbnail?.startsWith('/api/')) {
        try {
          const response = await fetch(directThumbnail);
          const data = await response.json();
          if (data.thumbnail) {
            setThumbnail(data.thumbnail);
          } else {
            setThumbnail(null);
          }
        } catch (error) {
          console.error('Error fetching thumbnail:', error);
          setThumbnail(null);
        } finally {
          setLoading(false);
        }
      } else {
        // For Instagram URLs not yet processed
        const instagramRegex = /instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/;
        if (instagramRegex.test(url)) {
          try {
            const response = await fetch(`/api/video-thumbnail?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            if (data.thumbnail) {
              setThumbnail(data.thumbnail);
            } else {
              setThumbnail(null);
            }
          } catch (error) {
            console.error('Error fetching Instagram thumbnail:', error);
            setThumbnail(null);
          } finally {
            setLoading(false);
          }
        } else {
          setThumbnail(null);
          setLoading(false);
        }
      }
    };

    fetchThumbnail();
  }, [url, isImage]);

  if (loading) {
    return (
      <div className={`bg-gray-200 animate-pulse ${className}`} style={fill ? {} : { width, height }} />
    );
  }

  if (thumbnail) {
    return (
      <Image
        src={thumbnail}
        alt={alt}
        fill={fill}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        className={className}
        unoptimized
      />
    );
  }

  // Fallback placeholder
  return (
    <div className={`bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center ${className}`} style={fill ? {} : { width, height }}>
      <div className="text-center">
        <span className="text-4xl opacity-80 block mb-2">▶</span>
        <span className="text-white text-xs opacity-75">Video</span>
      </div>
    </div>
  );
}

