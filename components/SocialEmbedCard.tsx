"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildOfficialEmbedUrl } from "@/lib/videoThumbnail";
import { useLazyVideoThumbnail } from "@/lib/useVideoThumbnail";
import {
  buildTikTokPlayerUrl,
  extractTikTokVideoId,
} from "@/lib/tikTokPlayer";
type Provider = "instagram" | "tiktok" | "youtube";

interface SocialEmbedCardProps {
  provider: Provider;
  originalUrl: string;
  lang?: "el" | "en";
  /** @deprecated Prefer originalUrl; kept for call-site compatibility. */
  embedUrl?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

const COPY = {
  play: { el: "Αναπαραγωγή", en: "Play" },
  playVideo: { el: "Προβολή βίντεο", en: "Play video" },
  viewPhoto: { el: "Προβολή φωτογραφίας", en: "View photo" },
  loading: { el: "Φόρτωση", en: "Loading" },
  error: { el: "Αποτυχία φόρτωσης", en: "Failed to load" },
  retry: { el: "Δοκιμή ξανά", en: "Try again" },
} as const;

const NAMES: Record<Provider, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const COLORS: Record<Provider, string> = {
  instagram: "from-purple-600 to-pink-600",
  tiktok: "from-black to-gray-900",
  youtube: "from-red-600 to-red-700",
};

const DEFAULT_DIMENSIONS: Record<Provider, { width: number; height: number }> = {
  instagram: { width: 400, height: 500 },
  tiktok: { width: 400, height: 600 },
  youtube: { width: 560, height: 315 },
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTikTokEmbedUrl(originalUrl: string): Promise<string> {
  const apiUrl = `/api/video-embed?url=${encodeURIComponent(originalUrl)}`;
  const attempt = async () => {
    const res = await fetch(apiUrl);
    if (res.status === 429 || res.status >= 500) {
      const err = new Error(`HTTP ${res.status}`);
      (err as Error & { retryable?: boolean }).retryable = true;
      throw err;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { embed_url?: string };
    if (!data.embed_url) throw new Error("Missing embed_url");
    return String(data.embed_url);
  };

  try {
    return await attempt();
  } catch (err) {
    if ((err as { retryable?: boolean })?.retryable) {
      await sleep(1500);
      return attempt();
    }
    throw err;
  }
}

async function fetchInstagramNativeVideo(
  originalUrl: string
): Promise<{ videoUrl: string | null; poster: string | null }> {
  const res = await fetch(`/api/instagram-video?url=${encodeURIComponent(originalUrl)}`);
  if (!res.ok) return { videoUrl: null, poster: null };
  const data = (await res.json()) as { videoUrl?: string | null; poster?: string | null };
  return {
    videoUrl: data.videoUrl ? String(data.videoUrl) : null,
    poster: data.poster ? String(data.poster) : null,
  };
}

/**
 * Social video card:
 * - YouTube / TikTok / Instagram: facade with cover + ▶; media only after click.
 * - Instagram reels: native <video> when /api/instagram-video finds an MP4; else official iframe.
 * - Instagram /p/ photos: official embed on click.
 */
export default function SocialEmbedCard({
  provider,
  originalUrl,
  lang = "el",
  width,
  height,
}: SocialEmbedCardProps) {
  const finalWidth = width || DEFAULT_DIMENSIONS[provider].width;
  const finalHeight = height || DEFAULT_DIMENSIONS[provider].height;
  const uiLang = lang === "en" ? "en" : "el";
  const isInstagram = provider === "instagram";
  const rootRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);

  const [activated, setActivated] = useState(false);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [nativeVideoUrl, setNativeVideoUrl] = useState<string | null>(null);
  const [nativePoster, setNativePoster] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const { src: thumbSrc, mediaType, onImgError } = useLazyVideoThumbnail(
    originalUrl,
    nearViewport && !activated
  );
  const isPhotoMedia = mediaType === "image";

  useEffect(() => {
    const node = rootRef.current;
    if (!node || nearViewport) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px", threshold: 0.01 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [nearViewport]);

  const fallBackToOfficialEmbed = useCallback(() => {
    setNativeVideoUrl(null);
    const official = buildOfficialEmbedUrl(originalUrl, { autoplay: false });
    if (!official) {
      setError(true);
      setLoading(false);
      return;
    }
    setIframeSrc(official);
    setLoading(false);
  }, [originalUrl]);

  const activateClickToLoad = useCallback(async () => {
    if (loading || iframeSrc || nativeVideoUrl) return;
    setError(false);
    setActivated(true);
    setLoading(true);
    try {
      if (provider === "youtube") {
        const official = buildOfficialEmbedUrl(originalUrl, { autoplay: true });
        if (!official) throw new Error("Missing YouTube embed");
        setIframeSrc(official);
        setLoading(false);
        return;
      }

      if (provider === "tiktok") {
        let videoId = extractTikTokVideoId(originalUrl);
        if (!videoId) {
          const embedOrResolved = await fetchTikTokEmbedUrl(originalUrl);
          videoId = extractTikTokVideoId(embedOrResolved);
        }
        if (!videoId) throw new Error("Missing TikTok video id");
        setIframeSrc(buildTikTokPlayerUrl(videoId, { muted: false }));
        setLoading(false);
        return;
      }

      // Instagram photo posts keep the official embed; reels/videos try native MP4 first.
      if (mediaType === "image") {
        fallBackToOfficialEmbed();
        return;
      }

      const { videoUrl, poster } = await fetchInstagramNativeVideo(originalUrl);
      if (videoUrl) {
        setNativeVideoUrl(videoUrl);
        setNativePoster(poster);
        setLoading(false);
        return;
      }
      fallBackToOfficialEmbed();
    } catch {
      setError(true);
      setLoading(false);
    }
  }, [
    fallBackToOfficialEmbed,
    iframeSrc,
    loading,
    mediaType,
    nativeVideoUrl,
    originalUrl,
    provider,
  ]);

  const showClickFacade = !activated || error;
  const playLabel = isInstagram ? COPY.play[uiLang] : COPY.playVideo[uiLang];

  return (
    <div className="w-full max-w-full" ref={rootRef}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden w-full max-w-full">
        <div
          className="relative w-full bg-slate-100"
          style={{ aspectRatio: `${finalWidth} / ${finalHeight}`, minHeight: 300 }}
        >
          <div
            className={`absolute inset-0 bg-gradient-to-br ${COLORS[provider]}`}
            aria-hidden
          />

          {showClickFacade && thumbSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- CDN/proxy URLs; lazy cover only
            <img
              src={thumbSrc}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover"
              onError={onImgError}
            />
          ) : null}

          {showClickFacade ? (
            <button
              type="button"
              onClick={() => {
                void activateClickToLoad();
              }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-gradient-to-t from-black/70 via-black/25 to-black/10 text-white transition hover:from-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              aria-label={
                error
                  ? COPY.retry[uiLang]
                  : isPhotoMedia
                    ? COPY.viewPhoto[uiLang]
                    : playLabel
              }
            >
              <span className="text-sm font-semibold tracking-wide uppercase opacity-95 drop-shadow">
                {NAMES[provider]}
              </span>
              {isPhotoMedia ? (
                <span className="absolute top-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-black/55 text-white shadow-sm backdrop-blur-sm">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
                    <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm3 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-1 11 3.5-4.5 2.5 3 3.5-4.5L19 18H6z" />
                  </svg>
                </span>
              ) : (
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg">
                  <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8 fill-current" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              )}
              <span className="text-base font-bold drop-shadow">
                {error
                  ? COPY.retry[uiLang]
                  : isPhotoMedia
                    ? COPY.viewPhoto[uiLang]
                    : playLabel}
              </span>
              {error ? (
                <span className="text-xs font-medium text-white/85">{COPY.error[uiLang]}</span>
              ) : null}
            </button>
          ) : null}

          {activated && loading ? (
            <div
              className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-br ${COLORS[provider]}`}
            >
              <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
              <span className="text-xs font-medium text-white">
                {COPY.loading[uiLang]} {NAMES[provider]}…
              </span>
            </div>
          ) : null}

          {nativeVideoUrl ? (
            <video
              src={nativeVideoUrl}
              poster={nativePoster || thumbSrc || undefined}
              controls
              autoPlay
              playsInline
              className="absolute inset-0 z-[5] h-full w-full bg-black object-contain"
              ref={(el) => {
                if (el) el.setAttribute("referrerpolicy", "no-referrer");
              }}
              onError={() => {
                fallBackToOfficialEmbed();
              }}
            />
          ) : null}

          {iframeSrc ? (
            <iframe
              src={iframeSrc}
              title={`${NAMES[provider]} video`}
              className={`absolute top-0 left-0 z-[5] h-full w-full border-0 ${
                iframeLoaded ? "opacity-100" : "opacity-100"
              }`}
              allow={
                provider === "tiktok"
                  ? "autoplay; encrypted-media; fullscreen; picture-in-picture"
                  : "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              }
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => {
                setIframeLoaded(true);
                setLoading(false);
              }}
              onError={() => {
                setError(true);
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
