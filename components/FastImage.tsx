"use client";

import Image, { type ImageProps } from "next/image";
import type { SyntheticEvent } from "react";
import { getCachedImageUrl } from "@/lib/imageProxy";

const SKIP_OPTIMIZER_HOSTS = [
  "unavatar.io",
  "ui-avatars.com",
  "img.youtube.com",
  "i.ytimg.com",
];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isExternalThumbnailHost(host: string): boolean {
  if (SKIP_OPTIMIZER_HOSTS.includes(host)) return true;
  if (host.includes("tiktokcdn") || host.includes("ibytedtos")) return true;
  if (host.endsWith("supabase.co") || host.endsWith("supabase.in")) return true;
  return false;
}

function numericSize(value: ImageProps["width"] | ImageProps["height"]): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Skip Next Image Optimization for proxy / small avatars / external thumbs. */
export function shouldSkipImageOptimization(
  url: string,
  dims?: { width?: ImageProps["width"]; height?: ImageProps["height"]; sizes?: string }
): boolean {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return true;
  if (url.startsWith("/api/image-proxy")) return true;
  const host = hostOf(url);
  if (host && isExternalThumbnailHost(host)) return true;
  const w = numericSize(dims?.width);
  const h = numericSize(dims?.height);
  if ((w != null && w <= 128) || (h != null && h <= 128)) return true;
  // sizes like "80px" / "64px" for avatars
  const sizes = dims?.sizes?.trim() || "";
  const px = sizes.match(/^(\d+)px$/);
  if (px && Number(px[1]) <= 128) return true;
  return false;
}

/** Hosts where Next.js Image optimization is still worth the hop. */
export function canOptimizeRemoteUrl(url: string): boolean {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return false;
  if (url.startsWith("/")) return !url.startsWith("/api/image-proxy");
  try {
    const host = new URL(url).hostname;
    if (isExternalThumbnailHost(host)) return false;
    if (host === "images.unsplash.com" || host === "plus.unsplash.com") return true;
    return false;
  } catch {
    return false;
  }
}

type FastImageProps = Omit<ImageProps, "src"> & {
  src: string;
};

/**
 * Prefer next/image only when the optimizer helps.
 * Proxy / small / CDN thumbs use native <img> (or unoptimized Image) to cut
 * Image Optimization transformations — without changing layout.
 */
export default function FastImage({
  src,
  alt,
  className,
  fill,
  sizes,
  width,
  height,
  priority,
  quality = 75,
  onError,
  ...rest
}: FastImageProps) {
  const resolved = (getCachedImageUrl(src) ?? src).trim();
  const skip = shouldSkipImageOptimization(resolved, { width, height, sizes });
  const q = quality === 70 || quality === 75 ? quality : 75;

  if (skip || !canOptimizeRemoteUrl(resolved)) {
    // eslint-disable-next-line @next/next/no-img-element -- proxy + thumbs + small avatars
    return (
      <img
        src={resolved}
        alt={alt}
        className={className}
        width={typeof width === "number" ? width : undefined}
        height={typeof height === "number" ? height : undefined}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onError={onError as ((e: SyntheticEvent<HTMLImageElement, Event>) => void) | undefined}
        style={
          fill
            ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }
            : undefined
        }
      />
    );
  }

  return (
    <Image
      src={resolved}
      alt={alt}
      className={className}
      fill={fill}
      sizes={sizes}
      width={width}
      height={height}
      priority={priority}
      quality={q}
      onError={onError}
      {...rest}
    />
  );
}
