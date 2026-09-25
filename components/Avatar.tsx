"use client";

import Image from "next/image";
import { getCachedImageUrl } from "@/lib/imageProxy";

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
  const displaySrc = getCachedImageUrl(src) ?? src;
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

  const isProxy = displaySrc.startsWith("/api/image-proxy");
  const isLocal = displaySrc.startsWith("http") && displaySrc.includes("localhost");
  // Let Next.js resize/compress remote Supabase images (much smaller than raw 200–800KB avatars).
  const unoptimized = isProxy || isLocal;

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
        unoptimized={unoptimized}
        priority={priority}
        loading={priority ? undefined : "lazy"}
      />
    </div>
  );
}
