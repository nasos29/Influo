"use client";

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import Image from "next/image";
import { buildOfficialEmbedUrl, getVideoThumbnail, isVideoUrl } from "@/lib/videoThumbnail";
import { refreshVideoThumbnail } from "@/lib/useVideoThumbnail";
import {
  isCdnThumbnailUrl,
  thumbnailProxySrc,
  toDisplayThumbnailSrc,
} from "@/lib/videoThumbnailExtract";
import {
  buildTikTokPlayerUrl,
  extractTikTokVideoId,
} from "@/lib/tikTokPlayer";
import { TIKTOK_SOUND_COPY, useTikTokPlayerHost } from "@/lib/useTikTokPlayerHost";
import {
  usePortfolioMediaControls,
  type PortfolioMediaKind,
} from "@/lib/usePortfolioMediaControls";
import TikTokSoundPromptButton from "@/components/TikTokSoundPromptButton";
import InstagramStaticCarousel from "@/components/InstagramStaticCarousel";
import { extractInstagramMedia } from "@/lib/instagramShortcode";
import type { InstagramEmbedKind } from "@/lib/instagramMediaType";

type MediaType = "video" | "image";

interface VideoThumbnailProps {
  url: string;
  manualThumbnail?: string;
  alt?: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  lang?: "el" | "en";
}

const ARIA = {
  photo: { el: "Φωτογραφία", en: "Photo" },
  video: { el: "Βίντεο", en: "Video" },
  album: { el: "Άλμπουμ", en: "Album" },
  openEmbed: { el: "Αναπαραγωγή", en: "Play" },
  viewPhotos: { el: "Προβολή άλμπουμ", en: "View album" },
  pause: { el: "Παύση", en: "Pause" },
  resume: { el: "Συνέχεια", en: "Resume" },
} as const;

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

function PlayBadge({ label }: { label: string }) {
  return (
    <span
      className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
      aria-label={label}
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-lg">
        <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6 fill-current" aria-hidden>
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  );
}

export default function VideoThumbnail({
  url,
  manualThumbnail,
  alt = "Video thumbnail",
  className = "",
  fill = false,
  width,
  height,
  lang = "el",
}: VideoThumbnailProps) {
  const uiLang = lang === "en" ? "en" : "el";
  const [thumbnail, setThumbnail] = useState<string | null>(manualThumbnail || null);
  const [mediaType, setMediaType] = useState<MediaType | undefined>(undefined);
  const [igKind, setIgKind] = useState<InstagramEmbedKind | null>(null);
  const [igImages, setIgImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);
  const [nativeVideoUrl, setNativeVideoUrl] = useState<string | null>(null);
  const proxiedRef = useRef(false);
  const refreshUsedRef = useRef(false);
  const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const isVideo = isVideoUrl(url);
  const isInstagram = /instagram\.com\/(?:(?:[A-Za-z0-9._]+)\/)?(p|reel|tv)\//i.test(url);
  const isTikTok = /tiktok\.com|(vm|vt)\.tiktok\.com/i.test(url);
  const igMedia = isInstagram ? extractInstagramMedia(url) : null;
  const isIgPost = igMedia?.kind === "p";
  const isIgReel = igMedia?.kind === "reel" || igMedia?.kind === "tv";
  const isTikTokPlayer =
    !!embedSrc && /tiktok\.com\/player\/v1\//i.test(embedSrc);
  const isYouTubePlayer =
    !!embedSrc && /youtube\.com\/embed\//i.test(embedSrc);
  const isTikTokPhotoEarly =
    isTikTok && (mediaType === "image" || /\/photo\/\d+/i.test(url));
  const portfolioKind: PortfolioMediaKind | null = nativeVideoUrl
    ? "native"
    : isTikTokPlayer
      ? "tiktok"
      : isYouTubePlayer
        ? "youtube"
        : null;
  // Never put play/pause overlay on photos / carousels (blocks ‹ › and dots).
  const portfolioActive =
    !!portfolioKind &&
    (!!embedSrc || !!nativeVideoUrl) &&
    !isTikTokPhotoEarly &&
    igKind !== "image" &&
    igKind !== "carousel";
  const {
    iframeRef: mediaIframeRef,
    videoRef: mediaVideoRef,
    playing: mediaPlaying,
    toggle: toggleMediaPlayback,
  } = usePortfolioMediaControls(portfolioKind, portfolioActive);
  const {
    iframeRef: tikTokIframeRef,
    showSoundPrompt: showTikTokSoundPrompt,
    onTapForSound: onTikTokTapForSound,
  } = useTikTokPlayerHost(isTikTokPlayer, mediaIframeRef);

  useEffect(() => {
    let cancelled = false;
    proxiedRef.current = false;
    refreshUsedRef.current = false;
    setIgKind(isIgReel ? "video" : null);
    setIgImages([]);

    const fetchThumbnail = async () => {
      setFailed(false);
      setEmbedSrc(null);
      setNativeVideoUrl(null);

      if (manualThumbnail) {
        if (!cancelled) {
          setThumbnail(manualThumbnail);
          setLoading(false);
        }
        return;
      }

      const imagePattern = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i;
      const isDirectImage =
        imagePattern.test(url) ||
        !!url.match(/^https?:\/\/.*\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i);

      if (isDirectImage || isImage) {
        if (!cancelled) {
          setThumbnail(url);
          setMediaType("image");
          setLoading(false);
        }
        return;
      }

      // Instagram /p/: resolve kind via meta (cached) so photos never show ▶.
      if (isIgPost) {
        try {
          const metaRes = await fetch(
            `/api/instagram-video?url=${encodeURIComponent(url)}&meta=1`
          );
          if (metaRes.ok) {
            const meta = (await metaRes.json()) as {
              mediaType?: string | null;
              poster?: string | null;
              images?: string[] | null;
            };
            if (cancelled) return;
            const proxied = proxyImageList(meta.images);
            if (proxied.length) setIgImages(proxied);
            if (meta.mediaType === "video" || meta.mediaType === "image" || meta.mediaType === "carousel") {
              setIgKind(meta.mediaType);
              if (meta.mediaType === "image" || meta.mediaType === "carousel") {
                setMediaType("image");
              } else {
                setMediaType("video");
              }
            } else if (meta.poster || proxied[0]) {
              // Old posts: null mediaType but recoverable cover → static image.
              setIgKind("image");
              setMediaType("image");
            }
            if (meta.poster) {
              setThumbnail(toDisplayThumbnailSrc(meta.poster) || meta.poster);
              setLoading(false);
              return;
            }
            if (proxied[0]) {
              setThumbnail(proxied[0]);
              setLoading(false);
              return;
            }
          }
        } catch {
          /* fall through to video-thumbnail */
        }
      }

      const directThumbnail = getVideoThumbnail(url);

      if (directThumbnail && !directThumbnail.startsWith("/api/")) {
        if (!cancelled) {
          setThumbnail(directThumbnail);
          setMediaType("video");
          setLoading(false);
        }
        return;
      }

      const apiUrl = directThumbnail?.startsWith("/api/")
        ? directThumbnail
        : isInstagram || isTikTok
          ? `/api/video-thumbnail?url=${encodeURIComponent(url)}`
          : null;

      if (apiUrl) {
        try {
          const response = await fetch(apiUrl);
          const data = (await response.json()) as {
            thumbnail?: string;
            mediaType?: MediaType;
          };
          if (cancelled) return;
          const display = toDisplayThumbnailSrc(data.thumbnail || null);
          setThumbnail(display);
          if (data.mediaType === "video" || data.mediaType === "image") {
            setMediaType(data.mediaType);
          } else if (!isIgPost) {
            setMediaType(undefined);
          }
        } catch (error) {
          console.error("Error fetching thumbnail:", error);
          if (!cancelled) {
            setThumbnail(null);
            if (!isIgPost) setMediaType(undefined);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setThumbnail(null);
        setLoading(false);
      }
    };

    void fetchThumbnail();
    return () => {
      cancelled = true;
    };
  }, [url, manualThumbnail, isImage, isInstagram, isTikTok, isIgPost, isIgReel]);

  const handleImgError = useCallback(() => {
    if (
      thumbnail &&
      !proxiedRef.current &&
      !thumbnail.startsWith("/api/thumbnail-proxy") &&
      !thumbnail.startsWith("/api/image-proxy") &&
      isCdnThumbnailUrl(thumbnail)
    ) {
      proxiedRef.current = true;
      setThumbnail(thumbnailProxySrc(thumbnail));
      return;
    }

    if (!refreshUsedRef.current && url) {
      refreshUsedRef.current = true;
      void (async () => {
        const refreshed = await refreshVideoThumbnail(url).catch(() => ({
          thumbnail: null as string | null,
        }));
        const display = toDisplayThumbnailSrc(refreshed.thumbnail);
        if (display) {
          proxiedRef.current = true;
          setThumbnail(display);
          return;
        }
        setFailed(true);
        setThumbnail(null);
      })();
      return;
    }

    setFailed(true);
    setThumbnail(null);
  }, [thumbnail, url]);

  const carouselImages =
    igImages.length > 1
      ? igImages
      : igImages.length === 1
        ? igImages
        : thumbnail
          ? [thumbnail]
          : [];
  const isInteractiveCarousel =
    igKind === "carousel" && carouselImages.length > 1;
  const isStaticImage =
    igKind === "image" || (igKind === "carousel" && !isInteractiveCarousel);

  // Never leave Instagram /p/ empty: if meta+thumb failed, load official embed.
  useEffect(() => {
    if (!isIgPost || loading || embedSrc || nativeVideoUrl) return;
    if (isStaticImage || isInteractiveCarousel) return;
    if (igKind === "video") return;
    if (thumbnail) {
      if (igKind === null) {
        setIgKind("image");
        setMediaType("image");
      }
      return;
    }
    if (failed || (!thumbnail && !loading)) {
      const official = buildOfficialEmbedUrl(url, { autoplay: false });
      if (official) setEmbedSrc(official);
    }
  }, [
    embedSrc,
    failed,
    igKind,
    isIgPost,
    isInteractiveCarousel,
    isStaticImage,
    loading,
    nativeVideoUrl,
    thumbnail,
    url,
  ]);

  const openInstagramEmbed = useCallback(() => {
    if (
      !isInstagram ||
      embedSrc ||
      nativeVideoUrl ||
      isStaticImage ||
      isInteractiveCarousel
    ) {
      return;
    }

    void (async () => {
      try {
        const res = await fetch(`/api/instagram-video?url=${encodeURIComponent(url)}`);
        if (res.ok) {
          const data = (await res.json()) as {
            videoUrl?: string | null;
            mediaType?: string | null;
            poster?: string | null;
            images?: string[] | null;
          };
          const proxied = proxyImageList(data.images);
          if (proxied.length) setIgImages(proxied);
          if (data.mediaType === "image" || (data.mediaType === "carousel" && proxied.length <= 1)) {
            setIgKind(data.mediaType === "carousel" ? "carousel" : "image");
            setMediaType("image");
            if (data.poster) {
              setThumbnail(toDisplayThumbnailSrc(data.poster) || data.poster);
            } else if (proxied[0]) {
              setThumbnail(proxied[0]);
            }
            return;
          }
          if (data.mediaType === "carousel" && proxied.length > 1) {
            setIgKind("carousel");
            setMediaType("image");
            if (data.poster) {
              setThumbnail(toDisplayThumbnailSrc(data.poster) || data.poster);
            }
            return;
          }
          if (data.videoUrl) {
            setNativeVideoUrl(String(data.videoUrl));
            return;
          }
        }
      } catch {
        /* fall through to iframe */
      }
      const official = buildOfficialEmbedUrl(url, { autoplay: false });
      if (official) setEmbedSrc(official);
    })();
  }, [
    embedSrc,
    isInstagram,
    isInteractiveCarousel,
    isStaticImage,
    nativeVideoUrl,
    url,
  ]);

  const openTikTokPlayer = useCallback(() => {
    if (!isTikTok || embedSrc || nativeVideoUrl) return;
    void (async () => {
      try {
        let videoId = extractTikTokVideoId(url);
        if (!videoId) {
          const res = await fetch(`/api/video-embed?url=${encodeURIComponent(url)}`);
          if (res.ok) {
            const data = (await res.json()) as { embed_url?: string };
            if (data.embed_url) videoId = extractTikTokVideoId(String(data.embed_url));
          }
        }
        if (!videoId) return;
        setEmbedSrc(buildTikTokPlayerUrl(videoId));
      } catch {
        /* keep thumbnail */
      }
    })();
  }, [embedSrc, isTikTok, nativeVideoUrl, url]);

  if (loading) {
    return (
      <div
        className={`bg-gray-200 animate-pulse ${className}`}
        style={fill ? {} : { width, height }}
      />
    );
  }

  if (nativeVideoUrl) {
    return (
      <div
        className={`relative overflow-hidden bg-slate-900 ${className}`}
        style={fill ? { width: "100%", height: "100%" } : { width, height, minHeight: 320 }}
      >
        <video
          src={nativeVideoUrl}
          controls
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-contain"
          ref={(el) => {
            mediaVideoRef.current = el;
            if (el) el.setAttribute("referrerpolicy", "no-referrer");
          }}
          onError={() => {
            setNativeVideoUrl(null);
            const official = buildOfficialEmbedUrl(url, { autoplay: false });
            if (official) setEmbedSrc(official);
          }}
        />
        <button
          type="button"
          className="absolute inset-x-0 top-0 bottom-14 z-[15] bg-transparent"
          aria-label={mediaPlaying ? ARIA.pause[uiLang] : ARIA.resume[uiLang]}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleMediaPlayback();
          }}
        />
      </div>
    );
  }

  if (embedSrc) {
    return (
      <div
        className={`relative overflow-hidden bg-slate-100 ${className}`}
        style={fill ? { width: "100%", height: "100%" } : { width, height, minHeight: 320 }}
      >
        <iframe
          ref={
            portfolioKind === "tiktok" || portfolioKind === "youtube"
              ? mediaIframeRef
              : isTikTokPlayer
                ? tikTokIframeRef
                : undefined
          }
          src={embedSrc}
          title={isTikTokPlayer ? "TikTok" : isYouTubePlayer ? "YouTube" : "Instagram"}
          className="absolute inset-0 h-full w-full border-0"
          allow={
            isTikTokPlayer
              ? "autoplay; encrypted-media; fullscreen; picture-in-picture"
              : "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          }
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
        {showTikTokSoundPrompt ? (
          <TikTokSoundPromptButton
            label={TIKTOK_SOUND_COPY[uiLang]}
            onClick={onTikTokTapForSound}
          />
        ) : null}
        {portfolioActive ? (
          <button
            type="button"
            className="absolute inset-x-0 top-0 bottom-16 z-[15] bg-transparent"
            aria-label={mediaPlaying ? ARIA.pause[uiLang] : ARIA.resume[uiLang]}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleMediaPlayback();
            }}
          />
        ) : null}
      </div>
    );
  }

  const isTikTokPhoto =
    isTikTok && (mediaType === "image" || /\/photo\/\d+/i.test(url));

  // Never show ▶ for Instagram photos/carousels or TikTok photo posts.
  const showPlayOverlay =
    !isStaticImage &&
    !isInteractiveCarousel &&
    !isTikTokPhoto &&
    (mediaType === "video" ||
      igKind === "video" ||
      isIgReel ||
      (!isIgPost && (isVideo || isTikTok)));
  const showPhotoOverlay = isTikTokPhoto && !!thumbnail && !failed;

  const mediaFrame = (inner: ReactNode) => (
    <div
      className={`relative overflow-hidden ${fill ? "h-full w-full" : ""} ${
        isStaticImage || isInteractiveCarousel ? "cursor-default" : ""
      } ${className}`}
    >
      {inner}
      {showPlayOverlay && thumbnail && !failed ? (
        <PlayBadge label={ARIA.video[uiLang]} />
      ) : null}
      {showPhotoOverlay ? (
        <span
          className="absolute top-2 right-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-white shadow-sm backdrop-blur-sm pointer-events-none"
          aria-label={ARIA.album[uiLang]}
          title={ARIA.viewPhotos[uiLang]}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
            <path d="M4 5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2H6a2 2 0 0 1-2-2V5zm2 0v10h8V5H6zm10 4v10h2V9h-2z" />
          </svg>
        </span>
      ) : null}
    </div>
  );

  if (isInteractiveCarousel) {
    return mediaFrame(
      <InstagramStaticCarousel
        images={carouselImages}
        lang={uiLang}
        alt={alt}
        imgClassName="h-full w-full object-cover"
        onImgError={handleImgError}
      />
    );
  }

  if (thumbnail && !failed) {
    // Static Instagram photo: plain object-cover image, no click / modal.
    if (isStaticImage) {
      return mediaFrame(
        // eslint-disable-next-line @next/next/no-img-element -- proxied CDN poster
        <img
          src={thumbnail}
          alt={alt}
          className="h-full w-full object-cover"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={handleImgError}
        />
      );
    }

    const isInstagramCDN =
      thumbnail.includes("cdninstagram.com") || thumbnail.includes("scontent.cdninstagram.com");

    const imgEl = isInstagramCDN ? (
      // eslint-disable-next-line @next/next/no-img-element -- CDN may block next/image
      <img
        src={thumbnail}
        alt={alt}
        className={fill ? "h-full w-full object-cover" : className}
        style={
          fill
            ? { width: "100%", height: "100%", objectFit: "cover" }
            : {
                width: "auto",
                height: "auto",
                maxWidth: "100%",
                maxHeight: "500px",
                objectFit: "contain",
              }
        }
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={handleImgError}
      />
    ) : (
      <Image
        src={thumbnail}
        alt={alt}
        fill={fill}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        sizes={fill ? undefined : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
        className={fill ? "object-cover" : className}
        unoptimized
        onError={handleImgError}
        style={
          fill
            ? undefined
            : {
                width: "auto",
                height: "auto",
                maxWidth: "100%",
                maxHeight: "500px",
                objectFit: "contain",
              }
        }
      />
    );

    if (isInstagram) {
      return mediaFrame(
        <button
          type="button"
          onClick={openInstagramEmbed}
          className="relative block h-full w-full cursor-pointer border-0 bg-transparent p-0 text-left"
          aria-label={ARIA.openEmbed[uiLang]}
        >
          {imgEl}
        </button>
      );
    }

    if (isTikTok) {
      return mediaFrame(
        <button
          type="button"
          onClick={openTikTokPlayer}
          className="relative block h-full w-full cursor-pointer border-0 bg-transparent p-0 text-left"
          aria-label={
            isTikTokPhoto ? ARIA.viewPhotos[uiLang] : ARIA.openEmbed[uiLang]
          }
        >
          {imgEl}
        </button>
      );
    }

    return mediaFrame(imgEl);
  }

  // Fallback when thumbnail is missing — platform icon + play (never a flat black box).
  const isYouTube = /youtube\.com|youtu\.be/i.test(url);
  let placeholderClass = "from-slate-600 to-slate-800";
  if (isInstagram) placeholderClass = "from-purple-600 to-pink-600";
  else if (isTikTok) placeholderClass = "from-slate-700 to-slate-900";
  else if (isYouTube) placeholderClass = "from-red-600 to-red-800";

  const showPlayButton = !isStaticImage && !isTikTokPhoto && mediaType !== "image";

  const placeholderBody = (
    <div
      className={`bg-gradient-to-br ${placeholderClass} flex items-center justify-center relative overflow-hidden ${
        fill ? "h-full w-full" : className
      } ${isStaticImage ? "cursor-default" : ""}`}
      style={fill ? {} : { width, height }}
    >
      <div className="absolute inset-0 opacity-10" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {isVideo || isInstagram || isTikTok || isYouTube ? (
        <div className="text-center relative z-10 px-4">
          {isInstagram ? (
            <div className="mb-3 flex justify-center">
              <svg className="w-10 h-10 text-white opacity-90" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </div>
          ) : isTikTok ? (
            <div className="mb-3 flex justify-center">
              <svg className="w-10 h-10 text-white opacity-90" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
              </svg>
            </div>
          ) : isYouTube ? (
            <div className="mb-3 flex justify-center">
              <svg className="w-10 h-10 text-white opacity-90" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </div>
          ) : null}
          {showPlayButton ? (
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
              <span className="ml-0.5 text-base text-slate-900" aria-hidden>
                ▶
              </span>
            </div>
          ) : null}
          <span className="text-white text-sm font-semibold tracking-wide">
            {isInstagram
              ? "Instagram"
              : isTikTok
                ? "TikTok"
                : isYouTube
                  ? "YouTube"
                  : mediaType === "image"
                    ? ARIA.photo[uiLang]
                    : "Video"}
          </span>
        </div>
      ) : (
        <div className="text-center relative z-10">
          <div className="mb-3 flex justify-center">
            <svg className="w-10 h-10 text-white opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <span className="text-white text-sm font-semibold tracking-wide opacity-75">Link</span>
        </div>
      )}
    </div>
  );

  // Static IG photo placeholder: non-interactive.
  if (isStaticImage) {
    return placeholderBody;
  }

  if (isInstagram) {
    return (
      <button
        type="button"
        onClick={openInstagramEmbed}
        className="relative block h-full w-full cursor-pointer border-0 bg-transparent p-0 text-left"
        aria-label={ARIA.openEmbed[uiLang]}
      >
        {placeholderBody}
      </button>
    );
  }

  if (isTikTok) {
    return (
      <button
        type="button"
        onClick={openTikTokPlayer}
        className="relative block h-full w-full cursor-pointer border-0 bg-transparent p-0 text-left"
        aria-label={
          isTikTokPhoto ? ARIA.viewPhotos[uiLang] : ARIA.openEmbed[uiLang]
        }
      >
        {placeholderBody}
      </button>
    );
  }

  return placeholderBody;
}
