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
  // TikTok / ByteDance thumbs are ephemeral and not worth the optimizer hop.
  if (host.includes("tiktokcdn") || host.includes("ibytedtos")) return true;
  return false;
}

/** Skip Next Image Optimization for data URLs and ephemeral third-party thumbs. */
export function shouldSkipImageOptimization(
  url: string,
  _dims?: { width?: ImageProps["width"]; height?: ImageProps["height"]; sizes?: string }
): boolean {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return true;
  const host = hostOf(url);
  if (host && isExternalThumbnailHost(host)) return true;
  return false;
}

/** Local proxy + Supabase + Unsplash are worth /_next/image (disk cache on this host). */
export function canOptimizeRemoteUrl(url: string): boolean {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return false;
  if (url.startsWith("/")) return true;
  try {
    const host = new URL(url).hostname;
    if (isExternalThumbnailHost(host)) return false;
    if (host === "images.unsplash.com" || host === "plus.unsplash.com") return true;
    if (host.endsWith("supabase.co") || host.endsWith("supabase.in")) return true;
    return false;
  } catch {
    return false;
  }
}

type FastImageProps = Omit<ImageProps, "src"> & {
  src: string;
};

/**
 * Prefer next/image (WebP + srcset, cached under .next/cache/images).
 * Skip only data/blob URLs and ephemeral third-party thumbs (TikTok, etc.).
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
  const q = quality === 70 || quality === 75 || quality === 80 ? quality : 75;

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
            ? {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                // Inline style beats classes, so honour object-contain/fill from className.
                objectFit: /(^|\s)object-contain(\s|$)/.test(className || "")
                  ? "contain"
                  : /(^|\s)object-fill(\s|$)/.test(className || "")
                    ? "fill"
                    : "cover",
              }
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
      unoptimized={Boolean(rest.unoptimized)}
    />
  );
}
