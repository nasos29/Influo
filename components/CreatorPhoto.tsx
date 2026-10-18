"use client";

import { useState } from "react";
import { getStorageCardUrl } from "@/lib/imageProxy";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] || "?") + (parts[1]?.[0] || "");
  return letters.toUpperCase();
}

function photoCandidates(src?: string | null): string[] {
  const raw = typeof src === "string" ? src.trim() : "";
  if (!raw || /placeholder|default-avatar/i.test(raw)) return [];
  const out: string[] = [];
  const resized = getStorageCardUrl(raw, 640, 800);
  if (typeof resized === "string" && resized && resized !== raw && !/placeholder|default-avatar/i.test(resized)) {
    out.push(resized);
  }
  out.push(raw);
  return out;
}

/** Photo with a letter fallback when the file is missing or the browser blocks it. */
export default function CreatorPhoto({
  src,
  name,
  className = "",
  rounded = "rounded-none",
  fill = false,
}: {
  src?: string | null;
  name: string;
  className?: string;
  rounded?: string;
  /** Stretch to the nearest positioned parent (suggestion cards). */
  fill?: boolean;
}) {
  const urls = photoCandidates(src);
  const [attempt, setAttempt] = useState(0);
  const [forSrc, setForSrc] = useState(src);
  if (forSrc !== src) {
    setForSrc(src);
    setAttempt(0);
  }
  const url = attempt < urls.length ? urls[attempt] : "";

  if (!url) {
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
      className={`object-cover ${rounded} ${className}`}
      style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" } : undefined}
      onError={() => setAttempt((n) => n + 1)}
    />
  );
}
