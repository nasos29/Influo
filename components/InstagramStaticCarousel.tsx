"use client";

import { useCallback, useRef, useState } from "react";

const COPY = {
  album: { el: "Άλμπουμ", en: "Album" },
  prev: { el: "Προηγούμενη", en: "Previous" },
  next: { el: "Επόμενη", en: "Next" },
} as const;

type Props = {
  images: string[];
  lang?: "el" | "en";
  alt?: string;
  className?: string;
  /** Extra class on the <img> */
  imgClassName?: string;
  onImgError?: () => void;
};

/**
 * Static Instagram carousel: first/current image only, no modal.
 * Multi-photo icon + ‹ › / swipe + position dots. Images must already be proxy URLs.
 */
export default function InstagramStaticCarousel({
  images,
  lang = "el",
  alt = "",
  className = "",
  imgClassName = "absolute inset-0 h-full w-full object-cover",
  onImgError,
}: Props) {
  const uiLang = lang === "en" ? "en" : "el";
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const count = images.length;
  const safeIndex = count > 0 ? ((index % count) + count) % count : 0;
  const src = images[safeIndex] || images[0];

  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      setIndex((i) => (i + delta + count) % count);
    },
    [count]
  );

  if (!src) return null;

  return (
    <div
      className={`relative h-full w-full select-none ${className}`}
      onTouchStart={(e) => {
        touchStartX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start == null || count < 2) return;
        const end = e.changedTouches[0]?.clientX ?? start;
        const dx = end - start;
        if (Math.abs(dx) < 40) return;
        go(dx < 0 ? 1 : -1);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- proxied CDN posters */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={imgClassName}
        draggable={false}
        onError={onImgError}
      />

      <span
        className="absolute top-2 right-2 z-20 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-white shadow-sm backdrop-blur-sm pointer-events-none"
        aria-label={COPY.album[uiLang]}
        title={COPY.album[uiLang]}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
          <path d="M4 5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2H6a2 2 0 0 1-2-2V5zm2 0v10h8V5H6zm10 4v10h2V9h-2z" />
        </svg>
      </span>

      {count > 1 ? (
        <>
          <button
            type="button"
            className="absolute left-1 top-1/2 z-20 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-lg font-semibold text-white shadow backdrop-blur-sm hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            aria-label={COPY.prev[uiLang]}
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className="absolute right-1 top-1/2 z-20 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-lg font-semibold text-white shadow backdrop-blur-sm hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            aria-label={COPY.next[uiLang]}
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
          >
            ›
          </button>
          <div
            className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 gap-1.5"
            aria-hidden
          >
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === safeIndex ? "bg-white" : "bg-white/45"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
