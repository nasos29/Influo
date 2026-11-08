"use client";

import { useState } from "react";
import { getCachedImageUrl, getStorageCardUrl } from "@/lib/imageProxy";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] || "?") + (parts[1]?.[0] || "");
  return letters.toUpperCase();
}

/** Photo with a letter fallback when the file is missing or the browser blocks it. */
export default function CreatorPhoto({
  src,
  name,
  className = "",
  rounded = "rounded-none",
  /**
   * Optional storage transform size in CSS px (square). When set, requests 2× via
   * Supabase image transform for small thumbs. Omit for large card/hero photos so
   * the original stays sharp (object-cover crops in CSS).
   */
  size,
}: {
  src?: string | null;
  name: string;
  className?: string;
  rounded?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const raw = typeof src === "string" ? src.trim() : "";
  const thumbPx = size && size > 0 ? Math.max(Math.round(size * 2), 160) : 0;
  const sized =
    raw && thumbPx > 0 ? (getStorageCardUrl(raw, thumbPx, thumbPx) ?? raw) : raw;
  const url = sized ? (getCachedImageUrl(sized) ?? sized) : "";
  const usable = url && !failed && !/placeholder|default-avatar/i.test(url);

  if (!usable) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-200 text-slate-600 font-semibold ${rounded} ${className}`}
        aria-hidden
      >
        {initials(name || "?")}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      className={`object-cover ${rounded} ${className}`}
      onError={() => setFailed(true)}
    />
  );
}
