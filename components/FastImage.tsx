"use client";

import Image, { type ImageProps } from "next/image";
import type { SyntheticEvent } from "react";

/** Hosts where Next.js Image optimization is worth the hop (configured in next.config). */
export function canOptimizeRemoteUrl(url: string): boolean {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return false;
  if (url.startsWith("/")) return !url.startsWith("/api/image-proxy");
  try {
    const host = new URL(url).hostname;
    if (host.endsWith("supabase.co") || host.endsWith("supabase.in")) return true;
    if (host === "images.unsplash.com" || host === "plus.unsplash.com") return true;
    if (host === "unavatar.io" || host === "ui-avatars.com") return true;
    if (host === "img.youtube.com" || host === "i.ytimg.com") return true;
    return false;
  } catch {
    return false;
  }
}

type FastImageProps = Omit<ImageProps, "src"> & {
  src: string;
};

/**
 * Prefer next/image (resized/WebP via /_next/image) for known hosts.
 * Fall back to native <img> for TikTok/IG CDNs that aren't worth the optimizer hop.
 */
export default function FastImage({
  src,
  alt,
  className,
  fill,
  sizes,
  priority,
  quality = 65,
  onError,
  ...rest
}: FastImageProps) {
  if (!canOptimizeRemoteUrl(src)) {
    // eslint-disable-next-line @next/next/no-img-element -- unknown / ephemeral CDN hosts
    return (
      <img
        src={src}
        alt={alt}
        className={className}
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
      src={src}
      alt={alt}
      className={className}
      fill={fill}
      sizes={sizes}
      priority={priority}
      quality={quality}
      onError={onError}
      {...rest}
    />
  );
}
