"use client";

import { useState, useEffect, useRef } from "react";

interface SocialEmbedCardProps {
  provider: "instagram" | "tiktok" | "youtube";
  embedUrl: string; // Can be API endpoint URL or direct Iframely URL
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  originalUrl?: string;
}

export default function SocialEmbedCard({
  provider,
  embedUrl,
  thumbnailUrl,
  width,
  height,
  originalUrl,
}: SocialEmbedCardProps) {
  const defaultDimensions = {
    instagram: { width: 400, height: 500 },
    tiktok: { width: 400, height: 600 },
    youtube: { width: 560, height: 315 },
  };

  const finalWidth = width || defaultDimensions[provider]?.width || 400;
  const finalHeight = height || defaultDimensions[provider]?.height || 500;

  const [poster, setPoster] = useState<string | null>(thumbnailUrl || null);
  const [posterFailed, setPosterFailed] = useState(false);
  const [posterLoading, setPosterLoading] = useState(!thumbnailUrl);
  const [playing, setPlaying] = useState(false);
  const [embedLoading, setEmbedLoading] = useState(false);
  const [error, setError] = useState(false);
  const [finalEmbedUrl, setFinalEmbedUrl] = useState<string | null>(
    embedUrl.startsWith("/api/video-embed") ? null : embedUrl
  );
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const providerConfig = {
    instagram: {
      name: "Instagram",
      color: "from-purple-600 to-pink-600",
      icon: (
        <svg className="w-12 h-12 text-white opacity-90" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      ),
    },
    tiktok: {
      name: "TikTok",
      color: "from-black to-gray-900",
      icon: (
        <svg className="w-12 h-12 text-white opacity-90" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
        </svg>
      ),
    },
    youtube: {
      name: "YouTube",
      color: "from-red-600 to-red-700",
      icon: (
        <svg className="w-12 h-12 text-white opacity-90" fill="currentColor" viewBox="0 0 24 24">
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
          <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
        </svg>
      ),
    },
  };

  const config = providerConfig[provider];

  const getOriginalUrl = () => {
    if (originalUrl) return originalUrl;
    try {
      const url = new URL(embedUrl.startsWith("http") ? embedUrl : `https://dummy.local${embedUrl}`);
      const urlParam = url.searchParams.get("url");
      if (urlParam) return decodeURIComponent(urlParam);
    } catch {
      /* ignore */
    }
    return originalUrl || "#";
  };

  // Fetch poster when missing
  useEffect(() => {
    if (thumbnailUrl) {
      setPoster(thumbnailUrl);
      setPosterLoading(false);
      return;
    }
    const src = getOriginalUrl();
    if (!src || src === "#") {
      setPosterLoading(false);
      return;
    }
    let cancelled = false;
    setPosterLoading(true);
    fetch(`/api/video-thumbnail?url=${encodeURIComponent(src)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.thumbnail) setPoster(data.thumbnail);
        else setPosterFailed(true);
      })
      .catch(() => {
        if (!cancelled) setPosterFailed(true);
      })
      .finally(() => {
        if (!cancelled) setPosterLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbnailUrl, originalUrl, embedUrl, provider]);

  // Resolve embed URL only when user clicks play
  useEffect(() => {
    if (!playing) return;
    if (finalEmbedUrl) {
      setEmbedLoading(false);
      return;
    }
    if (!embedUrl.startsWith("/api/video-embed")) {
      setFinalEmbedUrl(embedUrl);
      setEmbedLoading(false);
      return;
    }
    setEmbedLoading(true);
    fetch(embedUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.embed_url) setFinalEmbedUrl(data.embed_url);
        else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setEmbedLoading(false));
  }, [playing, embedUrl, finalEmbedUrl]);

  useEffect(() => {
    if (!playing || !finalEmbedUrl) return;
    timeoutRef.current = setTimeout(() => {
      // TikTok/IG iframes often never fire useful errors — if still "loading" feel, leave iframe.
    }, 12000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [playing, finalEmbedUrl]);

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
        <div
          className={`bg-gradient-to-br ${config.color} flex flex-col items-center justify-center p-8 min-h-[300px]`}
        >
          <div className="mb-4">{config.icon}</div>
          <p className="text-white text-sm font-semibold mb-4">{config.name}</p>
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

  // Click-to-play poster (avoids black empty TikTok/IG iframes on load)
  if (!playing) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden w-full max-w-full">
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="relative w-full block text-left group"
          style={{ aspectRatio: `${finalWidth} / ${finalHeight}`, minHeight: 300 }}
          aria-label={`Play ${config.name} video`}
        >
          {poster && !posterFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt={`${config.name} thumbnail`}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setPosterFailed(true)}
            />
          ) : (
            <div
              className={`absolute inset-0 bg-gradient-to-br ${config.color} flex flex-col items-center justify-center`}
            >
              {posterLoading ? (
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <div className="mb-3">{config.icon}</div>
                  <span className="text-white text-sm font-semibold">{config.name}</span>
                </>
              )}
            </div>
          )}
          <div className="absolute inset-0 bg-black/25 group-hover:bg-black/35 transition-colors" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-14 h-14 rounded-full bg-white/95 shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="text-slate-900 text-lg ml-0.5">▶</span>
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between gap-2">
            <span className="text-white text-xs font-medium">Play</span>
            <a
              href={getOriginalUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-white/90 text-[11px] underline underline-offset-2 hover:text-white"
            >
              Open on {config.name}
            </a>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden w-full max-w-full">
      {(embedLoading || !finalEmbedUrl) && (
        <div
          className={`bg-gradient-to-br ${config.color} flex flex-col items-center justify-center p-8 relative w-full`}
          style={{ aspectRatio: `${finalWidth} / ${finalHeight}`, minHeight: 300 }}
        >
          <div className="mb-4">{config.icon}</div>
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-white text-xs font-medium">Loading {config.name}…</span>
        </div>
      )}
      {finalEmbedUrl && !embedLoading && (
        <div className="relative w-full" style={{ aspectRatio: `${finalWidth} / ${finalHeight}` }}>
          <iframe
            src={finalEmbedUrl}
            className="absolute top-0 left-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onError={() => setError(true)}
          />
        </div>
      )}
    </div>
  );
}
