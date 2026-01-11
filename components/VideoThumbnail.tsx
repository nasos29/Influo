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
      console.log('VideoThumbnail: Processing URL:', url);
      
      // Check if it's an image URL (including URLs with image extensions)
      const imagePattern = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i;
      const isDirectImage = imagePattern.test(url) || url.match(/^https?:\/\/.*\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);
      
      if (isDirectImage || isImage) {
        console.log('VideoThumbnail: Direct image detected');
        setThumbnail(url);
        setLoading(false);
        return;
      }

      // Try direct thumbnail (YouTube)
      const directThumbnail = getVideoThumbnail(url);
      console.log('VideoThumbnail: getVideoThumbnail returned:', directThumbnail);
      
      if (directThumbnail && !directThumbnail.startsWith('/api/')) {
        console.log('VideoThumbnail: Using direct thumbnail');
        setThumbnail(directThumbnail);
        setLoading(false);
        return;
      }

      // For Instagram, TikTok or other platforms that need API call
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
        // For Instagram or TikTok URLs not yet processed
        const instagramRegex = /instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/;
        const tiktokRegex = /tiktok\.com\/@[\w.-]+\/video\/\d+/i;
        const tiktokShortRegex = /(vm|vt)\.tiktok\.com\/[\w-]+\/?/i;
        
        const isInstagramMatch = instagramRegex.test(url);
        const isTikTokMatch = tiktokRegex.test(url) || tiktokShortRegex.test(url);
        console.log('VideoThumbnail: Instagram match:', isInstagramMatch, 'TikTok match:', isTikTokMatch);
        
        if (isInstagramMatch || isTikTokMatch) {
          try {
            const apiUrl = `/api/video-thumbnail?url=${encodeURIComponent(url)}`;
            console.log('Fetching thumbnail from:', apiUrl);
            const response = await fetch(apiUrl);
            const data = await response.json();
            console.log('Thumbnail API response:', data);
            if (data.thumbnail) {
              setThumbnail(data.thumbnail);
            } else {
              console.warn('No thumbnail in API response for:', url);
              setThumbnail(null);
            }
          } catch (error) {
            console.error(`Error fetching ${tiktokRegex.test(url) ? 'TikTok' : 'Instagram'} thumbnail:`, error);
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
    // For Instagram CDN URLs, Instagram blocks these requests - use placeholder instead
    const isInstagramCDN = thumbnail.includes('cdninstagram.com') || thumbnail.includes('scontent.cdninstagram.com');
    
    if (isInstagramCDN) {
      // Instagram CDN blocks requests - show placeholder instead of trying to load
      // This prevents infinite error loops
      const isInstagram = /instagram\.com\/(?:p|reel)\//i.test(url);
      return (
        <div className={`bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center ${className}`} style={fill ? {} : { width, height }}>
          <div className="text-center">
            <div className="text-4xl mb-2">📷</div>
            <span className="text-white text-xs opacity-90 font-medium">Instagram</span>
          </div>
        </div>
      );
    }
    
    return (
      <Image
        src={thumbnail}
        alt={alt}
        fill={fill}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        sizes={fill ? undefined : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
        className={className}
        unoptimized
        style={fill ? undefined : { width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '500px', objectFit: 'contain' }}
      />
    );
  }

  // Fallback placeholder - show platform-specific logos
  const isInstagram = /instagram\.com\/(?:p|reel)\//i.test(url);
  const isTikTok = /tiktok\.com|(vm|vt)\.tiktok\.com/i.test(url);
  
  let placeholderClass = 'from-slate-700 to-slate-900';
  if (isInstagram) {
    placeholderClass = 'from-purple-600 to-pink-600';
  } else if (isTikTok) {
    placeholderClass = 'from-black to-gray-900';
  }
  
  return (
    <div className={`bg-gradient-to-br ${placeholderClass} flex items-center justify-center ${className}`} style={fill ? {} : { width, height }}>
      {isVideo || isInstagram || isTikTok ? (
        <div className="text-center">
          {isInstagram ? (
            <>
              <div className="text-4xl mb-2">📷</div>
              <span className="text-white text-xs opacity-90 font-medium">Instagram</span>
            </>
          ) : isTikTok ? (
            <>
              <div className="text-4xl mb-2">🎵</div>
              <span className="text-white text-xs opacity-90 font-medium">TikTok</span>
            </>
          ) : (
            <>
              <span className="text-xl opacity-80 block mb-2">▶</span>
              <span className="text-white text-xs opacity-75">Video</span>
            </>
          )}
        </div>
      ) : (
        <div className="text-center">
          <span className="text-3xl opacity-60">📎</span>
          <span className="text-white text-xs opacity-75 block mt-2">Link</span>
        </div>
      )}
    </div>
  );
}

