"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface SocialEmbedCardProps {
  provider: "instagram" | "tiktok" | "youtube";
  embedUrl: string;
  thumbnailUrl?: string;
  width?: number; // Optional - will use provider-specific defaults if not provided
  height?: number; // Optional - will use provider-specific defaults if not provided
  originalUrl?: string; // Original post URL for fallback button
}

export default function SocialEmbedCard({
  provider,
  embedUrl,
  thumbnailUrl,
  width,
  height,
  originalUrl,
}: SocialEmbedCardProps) {
  // Default dimensions based on provider - optimized for compact but viewable display
  const defaultDimensions = {
    instagram: { width: 400, height: 500 }, // Portrait/square posts - compact but viewable
    tiktok: { width: 400, height: 600 }, // Portrait videos - 9:16 aspect ratio
    youtube: { width: 560, height: 315 }, // 16:9 landscape - standard YouTube embed size
  };
  
  const finalWidth = width || defaultDimensions[provider]?.width || 400;
  const finalHeight = height || defaultDimensions[provider]?.height || 500;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(!!thumbnailUrl);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Provider-specific configurations
  const providerConfig = {
    instagram: {
      name: "Instagram",
      color: "from-purple-600 to-pink-600",
      icon: (
        <svg className="w-12 h-12 text-white opacity-90" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      ),
    },
    tiktok: {
      name: "TikTok",
      color: "from-black to-gray-900",
      icon: (
        <svg className="w-12 h-12 text-white opacity-90" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
        </svg>
      ),
    },
    youtube: {
      name: "YouTube",
      color: "from-red-600 to-red-700",
      icon: (
        <svg className="w-12 h-12 text-white opacity-90" fill="currentColor" viewBox="0 0 24 24">
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
          <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
        </svg>
      ),
    },
  };

  const config = providerConfig[provider];

  useEffect(() => {
    // Set a timeout to detect if iframe fails to load
    timeoutRef.current = setTimeout(() => {
      if (loading) {
        console.warn(`[SocialEmbedCard] Iframe loading timeout for ${provider}`);
        setError(true);
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [loading, provider]);

  const handleIframeLoad = () => {
    setLoading(false);
    setShowThumbnail(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handleIframeError = () => {
    setError(true);
    setLoading(false);
    setShowThumbnail(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  // Extract original URL from embedUrl if not provided
  const getOriginalUrl = () => {
    if (originalUrl) return originalUrl;
    
    // Try to extract from Iframely embed URL
    try {
      const url = new URL(embedUrl);
      const urlParam = url.searchParams.get('url');
      if (urlParam) return decodeURIComponent(urlParam);
    } catch (e) {
      console.warn('[SocialEmbedCard] Could not extract original URL from embedUrl');
    }
    
    return embedUrl;
  };

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
        <div className={`bg-gradient-to-br ${config.color} flex flex-col items-center justify-center p-8 min-h-[300px]`}>
          <div className="mb-4">{config.icon}</div>
          <p className="text-white text-sm font-semibold mb-4">{config.name}</p>
          <p className="text-white/80 text-xs mb-6 text-center px-4">
            Unable to load embed. Click below to view on {config.name}.
          </p>
          <a
            href={getOriginalUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-slate-900 px-6 py-3 rounded-lg font-semibold text-sm hover:bg-slate-100 transition-colors shadow-lg"
          >
            View on {config.name}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden w-full max-w-full">
      {/* Thumbnail Placeholder */}
      {showThumbnail && thumbnailUrl && (
        <div 
          className="relative w-full"
          style={{ aspectRatio: `${finalWidth} / ${finalHeight}` }}
        >
          <Image
            src={thumbnailUrl}
            alt={`${config.name} post thumbnail`}
            fill
            className="object-cover"
            unoptimized
            onError={() => setShowThumbnail(false)}
          />
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="text-white text-xs font-medium">Loading...</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading Spinner (when no thumbnail) */}
      {loading && !showThumbnail && (
        <div 
          className={`bg-gradient-to-br ${config.color} flex flex-col items-center justify-center p-8 relative w-full`}
          style={{ 
            aspectRatio: `${finalWidth} / ${finalHeight}`,
            minHeight: '300px'
          }}
        >
          <div className="mb-4">{config.icon}</div>
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mb-2"></div>
          <span className="text-white text-xs font-medium">Loading {config.name} embed...</span>
        </div>
      )}

      {/* Iframe Embed */}
      <div 
        className="relative w-full"
        style={{ 
          aspectRatio: `${finalWidth} / ${finalHeight}`,
          display: loading && showThumbnail ? 'none' : 'block'
        }}
      >
        <iframe
          ref={iframeRef}
          src={embedUrl}
          className="absolute top-0 left-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      </div>
    </div>
  );
}
