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

  const directEmbed = embedUrl.startsWith("/api/video-embed") ? "" : embedUrl;
  const [fetchedEmbed, setFetchedEmbed] = useState<string | null>(null);
  const finalEmbedUrl = directEmbed || fetchedEmbed;
  const [loading, setLoading] = useState(embedUrl.startsWith("/api/video-embed"));
  const [error, setError] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);

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
    if (!embedUrl.startsWith("/api/video-embed")) return;
    let cancelled = false;
    fetch(embedUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data.embed_url) {
          setFetchedEmbed(String(data.embed_url));
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

  const openHref = getOriginalUrl();
  const thumb = thumbnailUrl && !thumbFailed ? thumbnailUrl : "";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden w-full max-w-full">
      <div
        className="relative w-full bg-slate-900"
        style={{ aspectRatio: `${finalWidth} / ${finalHeight}`, minHeight: 220 }}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${colors[provider]}`} />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/25 p-4">
          <a
            href={openHref}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-slate-900 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-slate-100 shadow"
          >
            {names[provider]}
          </a>
          {finalEmbedUrl && !showEmbed && (
            <button
              type="button"
              onClick={() => setShowEmbed(true)}
              className="text-xs text-white underline"
            >
              {loading ? "…" : "Embed"}
            </button>
          )}
        </div>
        {showEmbed && finalEmbedUrl && (
          <iframe
            src={finalEmbedUrl}
            title={`${names[provider]} video`}
            className="absolute top-0 left-0 w-full h-full border-0 bg-white"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            onError={() => setError(true)}
          />
        )}
      </div>
    </div>
  );
}
