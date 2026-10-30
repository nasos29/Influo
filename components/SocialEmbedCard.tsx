"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildOfficialEmbedUrl } from "@/lib/videoThumbnail";
import { useLazyVideoThumbnail } from "@/lib/useVideoThumbnail";
import { toDisplayThumbnailSrc } from "@/lib/videoThumbnailExtract";
import {
  buildTikTokPlayerUrl,
  extractTikTokVideoId,
} from "@/lib/tikTokPlayer";
import { extractInstagramMedia } from "@/lib/instagramShortcode";
import type { InstagramEmbedKind } from "@/lib/instagramMediaType";

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
  viewCarousel: { el: "Προβολή άλμπουμ", en: "View album" },
  loading: { el: "Φόρτωση", en: "Loading" },
  error: { el: "Αποτυχία φόρτωσης", en: "Failed to load" },
  retry: { el: "Δοκιμή ξανά", en: "Try again" },
  close: { el: "Κλείσιμο", en: "Close" },
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

async function fetchInstagramMeta(originalUrl: string): Promise<{
  mediaType: InstagramEmbedKind | null;
  poster: string | null;
}> {
  const res = await fetch(
    `/api/instagram-video?url=${encodeURIComponent(originalUrl)}&meta=1`
  );
  if (!res.ok) return { mediaType: null, poster: null };
  const data = (await res.json()) as {
    mediaType?: string | null;
    poster?: string | null;
  };
  const mt = data.mediaType;
  const mediaType =
    mt === "video" || mt === "image" || mt === "carousel" ? mt : null;
  return {
    mediaType,
    poster: data.poster ? String(data.poster) : null,
  };
}

async function fetchInstagramNativeVideo(
  originalUrl: string
): Promise<{
  videoUrl: string | null;
  poster: string | null;
  mediaType: InstagramEmbedKind | null;
}> {
  const res = await fetch(`/api/instagram-video?url=${encodeURIComponent(originalUrl)}`);
  if (!res.ok) return { videoUrl: null, poster: null, mediaType: null };
  const data = (await res.json()) as {
    videoUrl?: string | null;
    poster?: string | null;
    mediaType?: string | null;
  };
  const mt = data.mediaType;
  return {
    videoUrl: data.videoUrl ? String(data.videoUrl) : null,
    poster: data.poster ? String(data.poster) : null,
    mediaType: mt === "video" || mt === "image" || mt === "carousel" ? mt : null,
  };
}

function CarouselBadge({ label }: { label: string }) {
  return (
    <span
      className="absolute top-3 right-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-black/55 text-white shadow-sm backdrop-blur-sm"
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
        <path d="M4 5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2H6a2 2 0 0 1-2-2V5zm2 0v10h8V5H6zm10 4v10h2V9h-2z" />
      </svg>
    </span>
  );
}

/**
 * Social video card:
 * - YouTube / TikTok / Instagram reels: facade with cover + ▶; media after click.
 * - Instagram /p/ photos (mediaType image): static cover only — no overlay/click.
 * - Instagram /p/ carousel: first frame + multi-image icon; click opens lightbox/embed.
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
  const igMedia = isInstagram ? extractInstagramMedia(originalUrl) : null;
  const isIgPost = igMedia?.kind === "p";
  const isIgReel = igMedia?.kind === "reel" || igMedia?.kind === "tv";
  const rootRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);

  const [activated, setActivated] = useState(false);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [nativeVideoUrl, setNativeVideoUrl] = useState<string | null>(null);
  const [nativePoster, setNativePoster] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [igKind, setIgKind] = useState<InstagramEmbedKind | null>(
    isIgReel ? "video" : null
  );
  const [igPoster, setIgPoster] = useState<string | null>(null);
  const [igMetaLoading, setIgMetaLoading] = useState(false);

  const isStaticImage = igKind === "image";
  const isCarousel = igKind === "carousel";

  const { src: thumbSrc, onImgError } = useLazyVideoThumbnail(
    originalUrl,
    // Static photos: still fetch cover if meta had no poster; otherwise facade cover.
    nearViewport &&
      !lightboxSrc &&
      !(isStaticImage && !!igPoster) &&
      (isStaticImage || (!activated && !iframeSrc && !nativeVideoUrl))
  );

  // /p/ posts: never show ▶ until meta confirms video (photos stay static).
  const showPlayButton =
    !isStaticImage && !isCarousel && (!isIgPost || igKind === "video");

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

  // Instagram /p/: resolve mediaType on mount (not only near viewport).
  useEffect(() => {
    if (!isInstagram || !isIgPost || igKind) return;
    let cancelled = false;
    setIgMetaLoading(true);
    void fetchInstagramMeta(originalUrl)
      .then((meta) => {
        if (cancelled) return;
        if (meta.mediaType) setIgKind(meta.mediaType);
        if (meta.poster) {
          setIgPoster(toDisplayThumbnailSrc(meta.poster) || meta.poster);
        }
      })
      .finally(() => {
        if (!cancelled) setIgMetaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [igKind, isIgPost, isInstagram, originalUrl]);

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

  const openCarouselLightbox = useCallback(() => {
    const src = igPoster || thumbSrc;
    if (src) {
      setLightboxSrc(src);
      setActivated(true);
      return;
    }
    fallBackToOfficialEmbed();
    setActivated(true);
  }, [fallBackToOfficialEmbed, igPoster, thumbSrc]);

  const activateClickToLoad = useCallback(async () => {
    if (loading || iframeSrc || nativeVideoUrl || lightboxSrc || isStaticImage) return;
    setError(false);

    if (isCarousel) {
      openCarouselLightbox();
      return;
    }

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

      // Instagram reel / video post
      const { videoUrl, poster, mediaType: mt } = await fetchInstagramNativeVideo(
        originalUrl
      );
      if (mt) setIgKind(mt);
      if (poster) {
        setIgPoster(toDisplayThumbnailSrc(poster) || poster);
      }

      if (mt === "image") {
        // Static photo — drop activation; no lightbox/embed.
        setActivated(false);
        setLoading(false);
        return;
      }

      if (mt === "carousel") {
        setLoading(false);
        const src = poster
          ? toDisplayThumbnailSrc(poster) || poster
          : thumbSrc;
        if (src) {
          setLightboxSrc(src);
          return;
        }
        fallBackToOfficialEmbed();
        return;
      }

      if (videoUrl) {
        setNativeVideoUrl(videoUrl);
        setNativePoster(poster ? toDisplayThumbnailSrc(poster) || poster : null);
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
    isCarousel,
    isStaticImage,
    lightboxSrc,
    loading,
    nativeVideoUrl,
    openCarouselLightbox,
    originalUrl,
    provider,
    thumbSrc,
  ]);

  const coverSrc = igPoster || thumbSrc || null;
  const playLabel = isInstagram ? COPY.play[uiLang] : COPY.playVideo[uiLang];
  const carouselLabel = COPY.viewCarousel[uiLang];

  return (
    <div className="w-full max-w-full" ref={rootRef}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden w-full max-w-full">
        <div
          className={`relative w-full bg-slate-100 ${isStaticImage ? "cursor-default" : ""}`}
          style={{ aspectRatio: `${finalWidth} / ${finalHeight}`, minHeight: 300 }}
        >
          <div
            className={`absolute inset-0 bg-gradient-to-br ${COLORS[provider]}`}
            aria-hidden
          />

          {!lightboxSrc && !iframeSrc && !nativeVideoUrl && coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- CDN/proxy URLs; lazy cover only
            <img
              src={coverSrc}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover"
              onError={onImgError}
            />
          ) : null}

          {/* Static Instagram photo: cover only — no overlay, badge, or click. */}
          {isStaticImage ? null : (
            <>
              {!activated && isCarousel ? (
                <CarouselBadge label={carouselLabel} />
              ) : null}

              {!activated || error ? (
                <button
                  type="button"
                  onClick={() => {
                    void activateClickToLoad();
                  }}
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-gradient-to-t from-black/70 via-black/25 to-black/10 text-white transition hover:from-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                  aria-label={
                    error
                      ? COPY.retry[uiLang]
                      : isCarousel
                        ? carouselLabel
                        : playLabel
                  }
                >
                  <span className="text-sm font-semibold tracking-wide uppercase opacity-95 drop-shadow">
                    {NAMES[provider]}
                  </span>
                  {showPlayButton ? (
                    <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg">
                      <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8 fill-current" aria-hidden>
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  ) : isCarousel ? null : igMetaLoading || (isIgPost && igKind === null) ? (
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
                  ) : null}
                  <span className="text-base font-bold drop-shadow">
                    {error
                      ? COPY.retry[uiLang]
                      : isCarousel
                        ? carouselLabel
                        : showPlayButton
                          ? playLabel
                          : COPY.loading[uiLang]}
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

              {lightboxSrc ? (
                <div className="absolute inset-0 z-[6] flex items-center justify-center bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={lightboxSrc}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <CarouselBadge label={carouselLabel} />
                  <button
                    type="button"
                    className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-900 shadow"
                    onClick={() => {
                      setLightboxSrc(null);
                      setActivated(false);
                    }}
                  >
                    {COPY.close[uiLang]}
                  </button>
                </div>
              ) : null}

              {nativeVideoUrl ? (
                <video
                  src={nativeVideoUrl}
                  poster={nativePoster || coverSrc || undefined}
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
                  title={`${NAMES[provider]} media`}
                  className="absolute top-0 left-0 z-[5] h-full w-full border-0 opacity-100"
                  allow={
                    provider === "tiktok"
                      ? "autoplay; encrypted-media; fullscreen; picture-in-picture"
                      : "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  }
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  onLoad={() => {
                    setLoading(false);
                  }}
                  onError={() => {
                    setError(true);
                  }}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
