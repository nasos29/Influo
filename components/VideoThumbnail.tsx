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
  const [failed, setFailed] = useState(false); // Track if thumbnail failed to load
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

  if (thumbnail && !failed) {
    // For Instagram CDN URLs, try direct load first (browser might handle it)
    // Only use proxy if direct load fails
    const isInstagramCDN = thumbnail.includes('cdninstagram.com') || thumbnail.includes('scontent.cdninstagram.com');
    
    if (isInstagramCDN) {
      // Try direct URL first - sometimes browser can load it even if server can't
      return (
        <img
          src={thumbnail}
          alt={alt}
          className={className}
          style={fill ? { width: '100%', height: '100%', objectFit: 'cover' } : { width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '500px', objectFit: 'contain' }}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            // If direct load fails, mark as failed to show placeholder (prevents infinite loop)
            console.warn('[VideoThumbnail] Direct Instagram CDN URL failed, showing placeholder');
            setFailed(true);
          }}
        />
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

  // Fallback placeholder - show platform-specific logos with professional styling
  const isInstagram = /instagram\.com\/(?:p|reel)\//i.test(url);
  const isTikTok = /tiktok\.com|(vm|vt)\.tiktok\.com/i.test(url);
  
  let placeholderClass = 'from-slate-700 to-slate-900';
  if (isInstagram) {
    placeholderClass = 'from-purple-600 to-pink-600';
  } else if (isTikTok) {
    placeholderClass = 'from-black to-gray-900';
  }
  
  return (
    <div className={`bg-gradient-to-br ${placeholderClass} flex items-center justify-center ${className} relative overflow-hidden`} style={fill ? {} : { width, height }}>
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }}></div>
      </div>
      
      {isVideo || isInstagram || isTikTok ? (
        <div className="text-center relative z-10">
          {isInstagram ? (
            <>
              {/* Instagram Icon */}
              <div className="mb-3 flex justify-center">
                <svg className="w-12 h-12 text-white opacity-90" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </div>
              <span className="text-white text-sm font-semibold tracking-wide">Instagram</span>
            </>
          ) : isTikTok ? (
            <>
              {/* TikTok Icon */}
              <div className="mb-3 flex justify-center">
                <svg className="w-12 h-12 text-white opacity-90" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
              </div>
              <span className="text-white text-sm font-semibold tracking-wide">TikTok</span>
            </>
          ) : (
            <>
              {/* Play Icon */}
              <div className="mb-3 flex justify-center">
                <svg className="w-12 h-12 text-white opacity-90" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
              <span className="text-white text-sm font-semibold tracking-wide">Video</span>
            </>
          )}
        </div>
      ) : (
        <div className="text-center relative z-10">
          {/* Link Icon */}
          <div className="mb-3 flex justify-center">
            <svg className="w-10 h-10 text-white opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <span className="text-white text-sm font-semibold tracking-wide opacity-75">Link</span>
        </div>
      )}
    </div>
  );
}

