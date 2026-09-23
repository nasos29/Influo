"use client";

import { useState, useEffect } from "react";

interface SocialEmbedCardProps {
  provider: "instagram" | "tiktok" | "youtube";
  embedUrl: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  originalUrl?: string;
}

/**
 * Show the official platform embed directly.
 * A custom Play overlay + native player Play = double-click; we avoid that.
 */
export default function SocialEmbedCard({
  provider,
  embedUrl,
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

  const [finalEmbedUrl, setFinalEmbedUrl] = useState<string | null>(
    embedUrl.startsWith("/api/video-embed") ? null : embedUrl
  );
  const [loading, setLoading] = useState(embedUrl.startsWith("/api/video-embed"));
  const [error, setError] = useState(false);

  const names = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube" };
  const colors = {
    instagram: "from-purple-600 to-pink-600",
    tiktok: "from-black to-gray-900",
    youtube: "from-red-600 to-red-700",
  };

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

  useEffect(() => {
    let cancelled = false;
    if (!embedUrl.startsWith("/api/video-embed")) {
      setFinalEmbedUrl(embedUrl);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    fetch(embedUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data.embed_url) {
          setFinalEmbedUrl(String(data.embed_url));
          setLoading(false);
        } else {
          setError(true);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [embedUrl]);

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
        <div
          className={`bg-gradient-to-br ${colors[provider]} flex flex-col items-center justify-center p-8 min-h-[300px]`}
        >
          <p className="text-white text-sm font-semibold mb-4">{names[provider]}</p>
          <a
            href={getOriginalUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-slate-900 px-6 py-3 rounded-lg font-semibold text-sm hover:bg-slate-100 transition-colors shadow-lg"
          >
            View on {names[provider]}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden w-full max-w-full">
      <div
        className="relative w-full bg-slate-100"
        style={{ aspectRatio: `${finalWidth} / ${finalHeight}`, minHeight: 300 }}
      >
        {loading && (
          <div
            className={`absolute inset-0 z-10 bg-gradient-to-br ${colors[provider]} flex flex-col items-center justify-center`}
          >
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-white text-xs font-medium">Loading {names[provider]}…</span>
          </div>
        )}
        {finalEmbedUrl && (
          <iframe
            src={finalEmbedUrl}
            title={`${names[provider]} video`}
            className="absolute top-0 left-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            onError={() => setError(true)}
          />
        )}
      </div>
      <div className="px-3 py-2 border-t border-slate-100 flex justify-end">
        <a
          href={getOriginalUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2"
        >
          Open on {names[provider]}
        </a>
      </div>
    </div>
  );
}
