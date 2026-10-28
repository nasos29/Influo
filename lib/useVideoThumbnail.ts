"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getVideoThumbnail } from "@/lib/videoThumbnail";

function isCdnThumbnail(url: string): boolean {
  return /cdninstagram\.com|scontent\.cdninstagram\.com|tiktokcdn|ibytedtos\.com/i.test(url);
}

function proxyUrl(imageUrl: string): string {
  return `/api/thumbnail-proxy?url=${encodeURIComponent(imageUrl)}`;
}

async function fetchApiThumbnail(apiOrOriginalUrl: string): Promise<string | null> {
  const apiUrl = apiOrOriginalUrl.startsWith("/api/video-thumbnail")
    ? apiOrOriginalUrl
    : `/api/video-thumbnail?url=${encodeURIComponent(apiOrOriginalUrl)}`;
  const res = await fetch(apiUrl);
  if (!res.ok) return null;
  const data = (await res.json()) as { thumbnail?: string };
  return data.thumbnail ? String(data.thumbnail) : null;
}

/**
 * Resolve a displayable thumbnail URL for a social video, matching VideoThumbnail's flow:
 * YouTube direct → Instagram/TikTok via /api/video-thumbnail → optional CDN proxy once on error.
 */
export async function resolveVideoThumbnailSrc(originalUrl: string): Promise<string | null> {
  if (!originalUrl) return null;
  const tip = getVideoThumbnail(originalUrl);
  if (!tip) return null;
  if (!tip.startsWith("/api/")) return tip;
  return fetchApiThumbnail(tip);
}

export type LazyVideoThumbnailState = {
  /** Image src to render (direct CDN or proxy). Null → use gradient fallback. */
  src: string | null;
  loading: boolean;
  /** Call from <img onError>. Tries /api/thumbnail-proxy once for CDN URLs. */
  onImgError: () => void;
};

/**
 * Lazy thumbnail: fetch only when `enabled` (e.g. IntersectionObserver near viewport).
 */
export function useLazyVideoThumbnail(
  originalUrl: string,
  enabled: boolean
): LazyVideoThumbnailState {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const rawSrcRef = useRef<string | null>(null);
  const proxiedRef = useRef(false);

  useEffect(() => {
    rawSrcRef.current = null;
    proxiedRef.current = false;
    setSrc(null);
    if (!enabled || !originalUrl) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    resolveVideoThumbnailSrc(originalUrl)
      .then((resolved) => {
        if (cancelled) return;
        rawSrcRef.current = resolved;
        setSrc(resolved);
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
    const raw = rawSrcRef.current;
    if (raw && !proxiedRef.current && isCdnThumbnail(raw)) {
      proxiedRef.current = true;
      setSrc(proxyUrl(raw));
      return;
    }
    setSrc(null);
  }, []);

  return { src, loading, onImgError };
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
    resolveVideoThumbnailSrc(url).then((src) => {
      if (!cancelled) setThumbnail(src);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return thumbnail;
}
