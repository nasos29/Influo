"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildOfficialEmbedUrl } from "@/lib/videoThumbnail";
import { useLazyVideoThumbnail } from "@/lib/useVideoThumbnail";
import {
  buildTikTokPlayerUrl,
  extractTikTokVideoId,
} from "@/lib/tikTokPlayer";
import {
  releaseInstagramEmbedSlot,
  requestInstagramEmbedSlot,
} from "@/lib/instagramEmbedQueue";

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
  play: { el: "Προβολή βίντεο", en: "Play video" },
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

const IG_SLOT_TIMEOUT_MS = 4000;

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

/**
 * Social video card:
 * - YouTube / TikTok: facade with cover + ▶; iframe only after click (TikTok → player/v1).
 * - Instagram: no facade; official embed mounts near viewport (queued, max 2 concurrent).
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
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const igSlotHeldRef = useRef(false);

  const { src: thumbSrc, onImgError } = useLazyVideoThumbnail(
    originalUrl,
    nearViewport && (isInstagram ? !iframeLoaded : !activated)
  );

  useEffect(() => {
    const node = rootRef.current;
    if (!node || nearViewport) return;
    const rootMargin = isInstagram ? "300px" : "200px";
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [nearViewport, isInstagram]);

  // Instagram: queue official embed when near viewport (no click facade).
  useEffect(() => {
    if (!isInstagram || !nearViewport || iframeSrc || error) return;

    let cancelled = false;
    let releaseTimer: ReturnType<typeof setTimeout> | null = null;

    const cancelWait = requestInstagramEmbedSlot(() => {
      if (cancelled) {
        releaseInstagramEmbedSlot();
        return;
      }
      igSlotHeldRef.current = true;
      const official = buildOfficialEmbedUrl(originalUrl, { autoplay: false });
      if (!official) {
        setError(true);
        igSlotHeldRef.current = false;
        releaseInstagramEmbedSlot();
        return;
      }
      setIframeSrc(official);
      setActivated(true);
      releaseTimer = setTimeout(() => {
        if (igSlotHeldRef.current) {
          igSlotHeldRef.current = false;
          releaseInstagramEmbedSlot();
        }
      }, IG_SLOT_TIMEOUT_MS);
    });

    return () => {
      cancelled = true;
      cancelWait();
      if (releaseTimer) clearTimeout(releaseTimer);
      if (igSlotHeldRef.current) {
        igSlotHeldRef.current = false;
        releaseInstagramEmbedSlot();
      }
    };
  }, [isInstagram, nearViewport, iframeSrc, error, originalUrl]);

  const releaseIgSlotIfHeld = useCallback(() => {
    if (igSlotHeldRef.current) {
      igSlotHeldRef.current = false;
      releaseInstagramEmbedSlot();
    }
  }, []);

  const activateClickToLoad = useCallback(async () => {
    if (isInstagram || loading || iframeSrc) return;
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

      // TikTok: official player/v1 for one-click play (muted so autoplay works).
      let videoId = extractTikTokVideoId(originalUrl);
      if (!videoId) {
        const embedOrResolved = await fetchTikTokEmbedUrl(originalUrl);
        videoId = extractTikTokVideoId(embedOrResolved);
      }
      if (!videoId) throw new Error("Missing TikTok video id");
      setIframeSrc(buildTikTokPlayerUrl(videoId, { muted: true }));
      setLoading(false);
    } catch {
      setError(true);
      setLoading(false);
    }
  }, [iframeSrc, isInstagram, loading, originalUrl, provider]);

  const showClickFacade = !isInstagram && (!activated || error);
  const showIgSkeleton = isInstagram && !iframeLoaded;

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

          {(showClickFacade || showIgSkeleton) && thumbSrc ? (
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

          {showIgSkeleton && !thumbSrc ? (
            <div
              className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/10 to-black/20"
              aria-hidden
            />
          ) : null}

          {showClickFacade ? (
            <button
              type="button"
              onClick={() => {
                void activateClickToLoad();
              }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-gradient-to-t from-black/70 via-black/25 to-black/10 text-white transition hover:from-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              aria-label={COPY.play[uiLang]}
            >
              <span className="text-sm font-semibold tracking-wide uppercase opacity-95 drop-shadow">
                {NAMES[provider]}
              </span>
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg">
                <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8 fill-current" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span className="text-base font-bold drop-shadow">
                {error ? COPY.retry[uiLang] : COPY.play[uiLang]}
              </span>
              {error ? (
                <span className="text-xs font-medium text-white/85">{COPY.error[uiLang]}</span>
              ) : null}
            </button>
          ) : null}

          {!isInstagram && activated && loading ? (
            <div
              className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-br ${COLORS[provider]}`}
            >
              <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
              <span className="text-xs font-medium text-white">
                {COPY.loading[uiLang]} {NAMES[provider]}…
              </span>
            </div>
          ) : null}

          {isInstagram && error ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 text-white">
              <span className="text-sm font-medium">{COPY.error[uiLang]}</span>
            </div>
          ) : null}

          {iframeSrc ? (
            <iframe
              src={iframeSrc}
              title={`${NAMES[provider]} video`}
              className={`absolute top-0 left-0 z-[5] h-full w-full border-0 ${
                isInstagram && !iframeLoaded ? "opacity-0" : "opacity-100"
              }`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => {
                setIframeLoaded(true);
                setLoading(false);
                releaseIgSlotIfHeld();
              }}
              onError={() => {
                setError(true);
                releaseIgSlotIfHeld();
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
