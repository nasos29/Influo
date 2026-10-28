"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getVideoThumbnail } from "@/lib/videoThumbnail";
import {
  extractInstagramShortcode,
  instagramThumbnailProxySrc,
} from "@/lib/instagramShortcode";
import {
  isCdnThumbnailUrl,
  thumbnailProxySrc,
  toDisplayThumbnailSrc,
} from "@/lib/videoThumbnailExtract";

const RETRY_DELAY_MS = 2500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
 * Resolve a displayable thumbnail URL for a social video:
 * Instagram → always /api/thumbnail-proxy?ig={shortcode}
 * YouTube direct → TikTok via /api/video-thumbnail → CDN via thumbnail-proxy.
 */
export async function resolveVideoThumbnailSrc(originalUrl: string): Promise<string | null> {
  if (!originalUrl) return null;

  const igCode = extractInstagramShortcode(originalUrl);
  if (igCode) {
    return instagramThumbnailProxySrc(igCode);
  }

  const tip = getVideoThumbnail(originalUrl);
  if (!tip) return null;
  if (!tip.startsWith("/api/")) return tip;
  const raw = await fetchApiThumbnail(tip);
  return toDisplayThumbnailSrc(raw);
}

async function resolveWithOneRetry(originalUrl: string): Promise<string | null> {
  try {
    const first = await resolveVideoThumbnailSrc(originalUrl);
    if (first) return first;
  } catch {
    /* retry below */
  }
  await sleep(RETRY_DELAY_MS);
  try {
    return await resolveVideoThumbnailSrc(originalUrl);
  } catch {
    return null;
  }
}

export type LazyVideoThumbnailState = {
  /** Image src to render (direct or proxied). Null → use gradient fallback. */
  src: string | null;
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
  const [loading, setLoading] = useState(false);
  const rawSrcRef = useRef<string | null>(null);
  const proxiedRef = useRef(false);
  const delayedRetryUsedRef = useRef(false);

  useEffect(() => {
    rawSrcRef.current = null;
    proxiedRef.current = false;
    delayedRetryUsedRef.current = false;
    setSrc(null);
    if (!enabled || !originalUrl) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void resolveWithOneRetry(originalUrl)
      .then((resolved) => {
        if (cancelled) return;
        rawSrcRef.current = resolved;
        if (resolved?.startsWith("/api/thumbnail-proxy")) {
          proxiedRef.current = true;
        }
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
        const resolved = await resolveVideoThumbnailSrc(originalUrl).catch(() => null);
        rawSrcRef.current = resolved;
        if (resolved?.startsWith("/api/thumbnail-proxy")) {
          proxiedRef.current = true;
        }
        setSrc(resolved);
        setLoading(false);
      })();
      return;
    }

    setSrc(null);
  }, [originalUrl]);

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
    void resolveWithOneRetry(url)
      .then((src) => {
        if (!cancelled) setThumbnail(src);
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
