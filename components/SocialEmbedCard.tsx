"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildOfficialEmbedUrl } from "@/lib/videoThumbnail";
import { useLazyVideoThumbnail } from "@/lib/useVideoThumbnail";
import { toDisplayThumbnailSrc } from "@/lib/videoThumbnailExtract";
import {
  buildTikTokPlayerUrl,
  extractTikTokVideoId,
} from "@/lib/tikTokPlayer";
import { TIKTOK_SOUND_COPY, useTikTokPlayerHost } from "@/lib/useTikTokPlayerHost";
import TikTokSoundPromptButton from "@/components/TikTokSoundPromptButton";
import InstagramStaticCarousel from "@/components/InstagramStaticCarousel";
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
  viewPhotos: { el: "Προβολή άλμπουμ", en: "View album" },
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

function proxyImageList(urls: string[] | null | undefined): string[] {
  if (!urls?.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const display = toDisplayThumbnailSrc(raw) || raw;
    if (!display || seen.has(display)) continue;
    seen.add(display);
    out.push(display);
  }
  return out;
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
  images: string[];
}> {
  const res = await fetch(
    `/api/instagram-video?url=${encodeURIComponent(originalUrl)}&meta=1`
  );
  if (!res.ok) return { mediaType: null, poster: null, images: [] };
  const data = (await res.json()) as {
    mediaType?: string | null;
    poster?: string | null;
    images?: string[] | null;
  };
  const mt = data.mediaType;
  const mediaType =
    mt === "video" || mt === "image" || mt === "carousel" ? mt : null;
  return {
    mediaType,
    poster: data.poster ? String(data.poster) : null,
    images: Array.isArray(data.images)
      ? data.images.filter((u): u is string => typeof u === "string")
      : [],
  };
}

async function fetchInstagramNativeVideo(
  originalUrl: string
): Promise<{
  videoUrl: string | null;
  poster: string | null;
  mediaType: InstagramEmbedKind | null;
  images: string[];
}> {
  const res = await fetch(`/api/instagram-video?url=${encodeURIComponent(originalUrl)}`);
  if (!res.ok) return { videoUrl: null, poster: null, mediaType: null, images: [] };
  const data = (await res.json()) as {
    videoUrl?: string | null;
    poster?: string | null;
    mediaType?: string | null;
    images?: string[] | null;
  };
  const mt = data.mediaType;
  return {
    videoUrl: data.videoUrl ? String(data.videoUrl) : null,
    poster: data.poster ? String(data.poster) : null,
    mediaType: mt === "video" || mt === "image" || mt === "carousel" ? mt : null,
    images: Array.isArray(data.images)
      ? data.images.filter((u): u is string => typeof u === "string")
      : [],
  };
}

/**
 * Social video card:
 * - YouTube / TikTok / Instagram reels: facade with cover + ▶; media after click.
 * - Instagram /p/ photos: static cover only — no overlay/click.
 * - Instagram /p/ carousel (images.length > 1): in-card swipe/arrows, no modal/label.
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [igKind, setIgKind] = useState<InstagramEmbedKind | null>(
    isIgReel ? "video" : null
  );
  const [igPoster, setIgPoster] = useState<string | null>(null);
  const [igImages, setIgImages] = useState<string[]>([]);
  const [igMetaLoading, setIgMetaLoading] = useState(false);
  const [igMetaDone, setIgMetaDone] = useState(!isIgPost);

  const carouselImages =
    igImages.length > 1
      ? igImages
      : igImages.length === 1
        ? igImages
        : igPoster
          ? [igPoster]
          : [];
  const isInteractiveCarousel =
    igKind === "carousel" && carouselImages.length > 1;
  // Carousel with ≤1 image behaves like a plain static photo.
  const isStaticImage =
    igKind === "image" || (igKind === "carousel" && !isInteractiveCarousel);

  const isTikTokPlayer =
    provider === "tiktok" && !!iframeSrc && /tiktok\.com\/player\/v1\//i.test(iframeSrc);
  const {
    iframeRef: tikTokIframeRef,
    showSoundPrompt: showTikTokSoundPrompt,
    onTapForSound: onTikTokTapForSound,
  } = useTikTokPlayerHost(isTikTokPlayer);

  const {
    src: thumbSrc,
    mediaType: thumbMediaType,
    onImgError,
  } = useLazyVideoThumbnail(
    originalUrl,
    // Static photos / carousels: still fetch cover if meta had no poster.
    nearViewport &&
      !iframeSrc &&
      !nativeVideoUrl &&
      !(isStaticImage && !!igPoster) &&
      !(isInteractiveCarousel && carouselImages.length > 0) &&
      (isStaticImage || isInteractiveCarousel || (!activated && !iframeSrc && !nativeVideoUrl))
  );

  const isTikTokPhoto =
    provider === "tiktok" &&
    (thumbMediaType === "image" || /\/photo\/\d+/i.test(originalUrl));

  // /p/ posts: never show ▶ unless meta confirms video. TikTok photos use album icon.
  const showPlayButton =
    !isStaticImage &&
    !isInteractiveCarousel &&
    !isTikTokPhoto &&
    (!isIgPost || igKind === "video");
  const showPhotoBadge = isTikTokPhoto && !iframeSrc;

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
    if (!isInstagram || !isIgPost || igKind) {
      if (isIgPost && igKind) setIgMetaDone(true);
      return;
    }
    let cancelled = false;
    setIgMetaLoading(true);
    void fetchInstagramMeta(originalUrl)
      .then((meta) => {
        if (cancelled) return;
        if (meta.mediaType) setIgKind(meta.mediaType);
        const proxied = proxyImageList(meta.images);
        if (proxied.length) setIgImages(proxied);
        if (meta.poster) {
          setIgPoster(toDisplayThumbnailSrc(meta.poster) || meta.poster);
        } else if (proxied[0]) {
          setIgPoster(proxied[0]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIgMetaLoading(false);
          setIgMetaDone(true);
        }
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
    setActivated(true);
    setLoading(false);
  }, [originalUrl]);

  // Never leave an empty Instagram /p/ card: cover from video-thumbnail, else official embed.
  useEffect(() => {
    if (!isIgPost || !igMetaDone || igMetaLoading) return;
    if (iframeSrc || nativeVideoUrl || activated) return;
    if (isStaticImage || isInteractiveCarousel) return;
    if (igKind === "video") return;
    // mediaType still null after meta — use thumb or embed.
    if (igKind === null) {
      const cover = igPoster || thumbSrc;
      if (cover) {
        setIgKind("image");
        setIgPoster(cover);
        return;
      }
      if (nearViewport) fallBackToOfficialEmbed();
    }
  }, [
    activated,
    fallBackToOfficialEmbed,
    igKind,
    igMetaDone,
    igMetaLoading,
    igPoster,
    iframeSrc,
    isIgPost,
    isInteractiveCarousel,
    isStaticImage,
    nativeVideoUrl,
    nearViewport,
    thumbSrc,
  ]);

  const activateClickToLoad = useCallback(async () => {
    if (
      loading ||
      iframeSrc ||
      nativeVideoUrl ||
      isStaticImage ||
      isInteractiveCarousel
    ) {
      return;
    }
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
        // muted=1 so autoplay works; unmute via TikTok postMessage after ready.
        setIframeSrc(buildTikTokPlayerUrl(videoId));
        setLoading(false);
        return;
      }

      // Instagram reel / video post
      const { videoUrl, poster, mediaType: mt, images } = await fetchInstagramNativeVideo(
        originalUrl
      );
      if (mt) setIgKind(mt);
      const proxied = proxyImageList(images);
      if (proxied.length) setIgImages(proxied);
      if (poster) {
        setIgPoster(toDisplayThumbnailSrc(poster) || poster);
      } else if (proxied[0]) {
        setIgPoster(proxied[0]);
      }

      if (mt === "image" || (mt === "carousel" && proxied.length <= 1)) {
        setActivated(false);
        setLoading(false);
        return;
      }

      if (mt === "carousel" && proxied.length > 1) {
        setActivated(false);
        setLoading(false);
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
    isInteractiveCarousel,
    isStaticImage,
    loading,
    nativeVideoUrl,
    originalUrl,
    provider,
  ]);

  const coverSrc = igPoster || thumbSrc || null;
  const playLabel = isInstagram
    ? COPY.play[uiLang]
    : isTikTokPhoto
      ? COPY.viewPhotos[uiLang]
      : COPY.playVideo[uiLang];
  const showStaticPhoto = isStaticImage && !iframeSrc && !nativeVideoUrl;
  const showCarousel =
    isInteractiveCarousel && !iframeSrc && !nativeVideoUrl && carouselImages.length > 1;

  return (
    <div className="w-full max-w-full" ref={rootRef}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden w-full max-w-full">
        <div
          className={`relative w-full bg-slate-100 ${
            showStaticPhoto || showCarousel ? "cursor-default" : ""
          }`}
          style={{ aspectRatio: `${finalWidth} / ${finalHeight}`, minHeight: 300 }}
        >
          <div
            className={`absolute inset-0 bg-gradient-to-br ${COLORS[provider]}`}
            aria-hidden
          />

          {showCarousel ? (
            <InstagramStaticCarousel
              images={carouselImages}
              lang={uiLang}
              onImgError={onImgError}
            />
          ) : null}

          {showStaticPhoto && coverSrc ? (
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

          {/* Non-static: video facade / player */}
          {!showStaticPhoto && !showCarousel ? (
            <>
              {!iframeSrc && !nativeVideoUrl && coverSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
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

              {/* Never leave a blank black TikTok card when cover is missing */}
              {!iframeSrc && !nativeVideoUrl && !coverSrc && provider === "tiktok" ? (
                <div
                  className="absolute inset-0 z-[1] flex items-center justify-center bg-gradient-to-br from-black to-gray-900"
                  aria-hidden
                >
                  <svg viewBox="0 0 24 24" className="h-14 w-14 fill-white/90" aria-hidden>
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                  </svg>
                </div>
              ) : null}

              {!activated || error ? (
                <button
                  type="button"
                  onClick={() => {
                    void activateClickToLoad();
                  }}
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-gradient-to-t from-black/70 via-black/25 to-black/10 text-white transition hover:from-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                  aria-label={error ? COPY.retry[uiLang] : playLabel}
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
                  ) : showPhotoBadge ? (
                    <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg">
                      <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current" aria-hidden>
                        <path d="M4 5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2H6a2 2 0 0 1-2-2V5zm2 0v10h8V5H6zm10 4v10h2V9h-2z" />
                      </svg>
                    </span>
                  ) : igMetaLoading || (isIgPost && igKind === null) ? (
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
                  ) : null}
                  <span className="text-base font-bold drop-shadow">
                    {error
                      ? COPY.retry[uiLang]
                      : showPlayButton || showPhotoBadge
                        ? playLabel
                        : isIgPost
                          ? COPY.loading[uiLang]
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
                <>
                  <iframe
                    ref={isTikTokPlayer ? tikTokIframeRef : undefined}
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
                  {showTikTokSoundPrompt ? (
                    <TikTokSoundPromptButton
                      label={TIKTOK_SOUND_COPY[uiLang]}
                      onClick={onTikTokTapForSound}
                    />
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
