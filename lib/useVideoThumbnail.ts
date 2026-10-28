"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getVideoThumbnail } from "@/lib/videoThumbnail";
import {
  extractInstagramMedia,
  extractInstagramShortcode,
  instagramThumbnailProxySrc,
} from "@/lib/instagramShortcode";
import {
  isCdnThumbnailUrl,
  thumbnailProxySrc,
  toDisplayThumbnailSrc,
} from "@/lib/videoThumbnailExtract";

const RETRY_DELAY_MS = 2500;

export type MediaType = "video" | "image";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ThumbApiResult = { thumbnail: string | null; mediaType?: MediaType };

async function fetchApiThumbnailResult(apiOrOriginalUrl: string): Promise<ThumbApiResult> {
  const apiUrl = apiOrOriginalUrl.startsWith("/api/video-thumbnail")
    ? apiOrOriginalUrl
    : `/api/video-thumbnail?url=${encodeURIComponent(apiOrOriginalUrl)}`;
  const res = await fetch(apiUrl);
  if (!res.ok) return { thumbnail: null };
  const data = (await res.json()) as { thumbnail?: string; mediaType?: string };
  const mediaType =
    data.mediaType === "video" || data.mediaType === "image"
      ? data.mediaType
      : undefined;
  return {
    thumbnail: data.thumbnail ? String(data.thumbnail) : null,
    mediaType,
  };
}

/** Infer mediaType without a network round-trip when the URL is unambiguous. */
export function inferMediaTypeFromUrl(originalUrl: string): MediaType | undefined {
  if (!originalUrl) return undefined;
  if (/\/photo\/\d+/i.test(originalUrl)) return "image";
  if (/tiktok\.com\/.*\/video\/\d+/i.test(originalUrl)) return "video";
  const ig = extractInstagramMedia(originalUrl);
  if (ig?.kind === "reel" || ig?.kind === "tv") return "video";
  if (/youtube\.com|youtu\.be/i.test(originalUrl)) return "video";
  return undefined;
}

export type ResolvedThumbnail = {
  src: string | null;
  mediaType?: MediaType;
};

/**
 * Resolve a displayable thumbnail URL (+ mediaType when known):
 * Instagram cover → /api/thumbnail-proxy?ig=…; mediaType from /api/video-thumbnail
 * (reel/tv → video without embed fetch; /p/ may detect Graph* type).
 */
export async function resolveVideoThumbnail(
  originalUrl: string
): Promise<ResolvedThumbnail> {
  if (!originalUrl) return { src: null };

  const inferred = inferMediaTypeFromUrl(originalUrl);
  const igCode = extractInstagramShortcode(originalUrl);
  const tip = getVideoThumbnail(originalUrl);

  if (igCode) {
    // Cover via stable proxy; mediaType from /api/video-thumbnail (cached 24h).
    const api = tip?.startsWith("/api/")
      ? tip
      : `/api/video-thumbnail?url=${encodeURIComponent(originalUrl)}`;
    if (inferred === "video") {
      // reel/tv — known video; warm cache without blocking cover paint
      void fetchApiThumbnailResult(api).catch(() => null);
      return { src: instagramThumbnailProxySrc(igCode), mediaType: "video" };
    }
    try {
      const result = await fetchApiThumbnailResult(api);
      return {
        src: instagramThumbnailProxySrc(igCode),
        mediaType: result.mediaType ?? inferred,
      };
    } catch {
      return { src: instagramThumbnailProxySrc(igCode), mediaType: inferred };
    }
  }

  if (!tip) return { src: null, mediaType: inferred };
  if (!tip.startsWith("/api/")) {
    return { src: tip, mediaType: inferred ?? "video" };
  }

  const result = await fetchApiThumbnailResult(tip);
  return {
    src: toDisplayThumbnailSrc(result.thumbnail),
    mediaType: result.mediaType ?? inferred,
  };
}

/** @deprecated Prefer resolveVideoThumbnail */
export async function resolveVideoThumbnailSrc(originalUrl: string): Promise<string | null> {
  const { src } = await resolveVideoThumbnail(originalUrl);
  return src;
}

async function resolveWithOneRetry(originalUrl: string): Promise<ResolvedThumbnail> {
  try {
    const first = await resolveVideoThumbnail(originalUrl);
    if (first.src) return first;
  } catch {
    /* retry below */
  }
  await sleep(RETRY_DELAY_MS);
  try {
    return await resolveVideoThumbnail(originalUrl);
  } catch {
    return { src: null };
  }
}

export type LazyVideoThumbnailState = {
  /** Image src to render (direct or proxied). Null → use gradient fallback. */
  src: string | null;
  mediaType?: MediaType;
  loading: boolean;
  /** Call from <img onError>. Proxy once for CDN, else one delayed re-resolve. */
  onImgError: () => void;
};

/**
 * Lazy thumbnail: fetch only when `enabled` (e.g. IntersectionObserver near viewport).
 * Empty API / fetch failure → one retry after ~2.5s before gradient fallback.
 */
export function useLazyVideoThumbnail(
  originalUrl: string,
  enabled: boolean
): LazyVideoThumbnailState {
  const [src, setSrc] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const rawSrcRef = useRef<string | null>(null);
  const proxiedRef = useRef(false);
  const delayedRetryUsedRef = useRef(false);

  useEffect(() => {
    rawSrcRef.current = null;
    proxiedRef.current = false;
    delayedRetryUsedRef.current = false;
    setSrc(null);
    setMediaType(inferMediaTypeFromUrl(originalUrl));
    if (!enabled || !originalUrl) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void resolveWithOneRetry(originalUrl)
      .then((resolved) => {
        if (cancelled) return;
        rawSrcRef.current = resolved.src;
        if (resolved.src?.startsWith("/api/thumbnail-proxy")) {
          proxiedRef.current = true;
        }
        setSrc(resolved.src);
        setMediaType(resolved.mediaType ?? inferMediaTypeFromUrl(originalUrl));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSrc(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [originalUrl, enabled]);

  const onImgError = useCallback(() => {
    const current = rawSrcRef.current;
    if (
      current &&
      !proxiedRef.current &&
      !current.startsWith("/api/thumbnail-proxy") &&
      isCdnThumbnailUrl(current)
    ) {
      proxiedRef.current = true;
      const proxied = thumbnailProxySrc(current);
      rawSrcRef.current = proxied;
      setSrc(proxied);
      return;
    }

    if (!delayedRetryUsedRef.current && originalUrl) {
      delayedRetryUsedRef.current = true;
      setLoading(true);
      void (async () => {
        await sleep(RETRY_DELAY_MS);
        const resolved = await resolveVideoThumbnail(originalUrl).catch(
          (): ResolvedThumbnail => ({ src: null })
        );
        rawSrcRef.current = resolved.src;
        if (resolved.src?.startsWith("/api/thumbnail-proxy")) {
          proxiedRef.current = true;
        }
        setSrc(resolved.src);
        if (resolved.mediaType) setMediaType(resolved.mediaType);
        setLoading(false);
      })();
      return;
    }

    setSrc(null);
  }, [originalUrl]);

  return { src, mediaType, loading, onImgError };
}

/** @deprecated Prefer useLazyVideoThumbnail — kept for older call sites. */
export function useVideoThumbnail(url: string | null): string | null {
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setThumbnail(null);
      return;
    }
    let cancelled = false;
    void resolveWithOneRetry(url)
      .then((resolved) => {
        if (!cancelled) setThumbnail(resolved.src);
      })
      .catch(() => {
        if (!cancelled) setThumbnail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return thumbnail;
}
