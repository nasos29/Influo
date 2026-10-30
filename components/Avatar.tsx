"use client";

import Image from "next/image";
import { getCachedImageUrl, getStorageCardUrl } from "@/lib/imageProxy";

interface AvatarProps {
  src: string | null | undefined;
  alt: string;
  size?: number;
  className?: string;
  /** Prefer eager for above-the-fold heroes / first cards */
  priority?: boolean;
}

export default function Avatar({
  src,
  alt,
  size = 80,
  className = "",
  priority = false,
}: AvatarProps) {
  const thumb = getStorageCardUrl(src, Math.max(size * 2, 160), Math.max(size * 2, 160));
  const displaySrc = getCachedImageUrl(thumb ?? src) ?? src;
  const hasImage =
    displaySrc &&
    displaySrc.trim() !== "" &&
    !displaySrc.includes("placeholder") &&
    !displaySrc.includes("default");

  if (!hasImage) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-200 rounded-full ${className}`}
        style={{ width: size, height: size }}
      >
        <span
          className="text-gray-500 font-medium text-xs"
          style={{ fontSize: `${size * 0.15}px` }}
        >
          NO PHOTO
        </span>
      </div>
    );
  }

  // Avatars are ≤128 CSS px almost always — never send through /_next/image.
  const isProxy = displaySrc.startsWith("/api/image-proxy");
  const unoptimized = true;

  return (
    <div
      className={`relative rounded-full overflow-hidden bg-slate-100 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={displaySrc}
        alt={alt}
        fill
        sizes={`${size}px`}
        className="object-cover"
        quality={75}
        unoptimized={unoptimized || isProxy}
        priority={priority}
        loading={priority ? undefined : "lazy"}
      />
    </div>
  );
}
