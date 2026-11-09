"use client";

import { useState, type CSSProperties } from "react";
import FastImage from "@/components/FastImage";
import { getCachedImageUrl, getStorageCardUrl } from "@/lib/imageProxy";
import { fallbackCategoryCover } from "@/lib/campaignCovers";

export function PlatformIcon({ platform, colored = true, className = "w-3.5 h-3.5" }: { platform: string; colored?: boolean; className?: string }) {
  const common = `${className} shrink-0`;
  const tone = (color: string) => (colored ? color : "text-white");
  if (platform === "instagram") {
    return (
      <svg viewBox="0 0 24 24" className={`${common} ${tone("text-pink-600")}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
      </svg>
    );
  }
  if (platform === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" className={`${common} ${tone("text-slate-900")}`} fill="currentColor" aria-hidden>
        <path d="M14 3h2.2a5.2 5.2 0 0 0 3.6 2.1v2.3a7.4 7.4 0 0 1-3.6-1v6.7a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v2.4a3.2 3.2 0 1 0 2.5 3.1V3z" />
      </svg>
    );
  }
  if (platform === "youtube") {
    return (
      <svg viewBox="0 0 24 24" className={`${common} ${tone("text-red-600")}`} fill="currentColor" aria-hidden>
        <path d="M23 12.2s0-3.2-.4-4.6a3 3 0 0 0-2.1-2.1C18.9 5 12 5 12 5s-6.9 0-8.5.5a3 3 0 0 0-2.1 2.1C1 9 1 12.2 1 12.2s0 3.2.4 4.6a3 3 0 0 0 2.1 2.1C5.1 19.4 12 19.4 12 19.4s6.9 0 8.5-.5a3 3 0 0 0 2.1-2.1c.4-1.4.4-4.6.4-4.6zM9.8 15.5v-6.6l6.2 3.3-6.2 3.3z" />
      </svg>
    );
  }
  if (platform === "facebook") {
    return (
      <svg viewBox="0 0 24 24" className={`${common} ${tone("text-blue-600")}`} fill="currentColor" aria-hidden>
        <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h2.6l.4-3H13v-2c0-.6.4-1 1-1z" />
      </svg>
    );
  }
  return null;
}

const GRADIENTS = [
  "from-indigo-500 via-violet-500 to-fuchsia-500",
  "from-rose-500 via-pink-500 to-orange-400",
  "from-emerald-500 via-teal-500 to-cyan-500",
  "from-amber-500 via-orange-500 to-red-500",
  "from-sky-500 via-blue-500 to-indigo-600",
  "from-fuchsia-500 via-purple-500 to-indigo-500",
  "from-lime-500 via-green-500 to-emerald-600",
  "from-slate-600 via-slate-700 to-slate-900",
];

function gradientFor(category: string | null | undefined): string {
  const key = (category || "").trim().toLowerCase();
  if (!key) return GRADIENTS[GRADIENTS.length - 1];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % (GRADIENTS.length - 1)];
}

/** Up to two letters: first of each word, or the first two of a single word. */
function brandInitials(name: string | null | undefined): string {
  const raw = (name || "").trim();
  if (!raw) return "B";
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]?.[0] || ""}${words[1]?.[0] || ""}`.toUpperCase() || "B";
  }
  return words[0].slice(0, 2).toUpperCase() || "B";
}

export default function CampaignCover({
  coverUrl,
  seed,
  title,
  brandName,
  logoUrl,
  category,
  platforms,
  aspect = "4/3",
  className = "",
  sizes = "(max-width: 768px) 100vw, 400px",
  priority = false,
  showBrandMark = true,
  /** On ≥lg screens, cap frame height (px) and switch main image to object-cover. Mobile unchanged. */
  desktopMaxHeightPx,
}: {
  coverUrl?: string | null;
  /** Stable seed (campaign id) for the category fallback cover. */
  seed?: string | null;
  title: string;
  brandName?: string | null;
  logoUrl?: string | null;
  category?: string | null;
  platforms?: string[] | null;
  aspect?: "4/3" | "16/9";
  className?: string;
  sizes?: string;
  priority?: boolean;
  /** When false, skip the bottom-left logo/initials mark (e.g. premium cards show avatar in the body). */
  showBrandMark?: boolean;
  desktopMaxHeightPx?: number | null;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const aspectClass = aspect === "16/9" ? "aspect-video" : "aspect-[4/3]";
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const desktopCap =
    typeof desktopMaxHeightPx === "number" && Number.isFinite(desktopMaxHeightPx) && desktopMaxHeightPx > 0
      ? Math.round(desktopMaxHeightPx)
      : null;
  const useFallback = !coverUrl || coverFailed;
  const effectiveCover = useFallback ? (fallbackFailed ? null : fallbackCategoryCover(category, seed || title)) : coverUrl;
  const hasCover = Boolean(effectiveCover);
  // Card-sized transforms for Supabase covers (full uploads are ~1600px); proxy cache after.
  const coverW = aspect === "16/9" ? (priority ? 1280 : 800) : priority ? 800 : 640;
  const coverH = aspect === "16/9" ? Math.round((coverW * 9) / 16) : Math.round((coverW * 3) / 4);
  const sizedCover = effectiveCover
    ? (getStorageCardUrl(effectiveCover, coverW, coverH) ?? effectiveCover)
    : null;
  const displayCover = sizedCover ? (getCachedImageUrl(sizedCover) ?? sizedCover) : null;
  // Tiny soft-fill source: blur a ~48px texture instead of a full card bitmap.
  const softFillRaw = effectiveCover
    ? (getStorageCardUrl(effectiveCover, 48, Math.round((48 * coverH) / coverW)) ?? effectiveCover)
    : null;
  const softFillCover = softFillRaw ? (getCachedImageUrl(softFillRaw) ?? softFillRaw) : null;
  // One resolved URL for the sharp mark and the blurred backdrop so the second
  // paint is a browser-cache hit (no extra Supabase egress).
  const logoSrc = logoUrl && !logoFailed ? getCachedImageUrl(logoUrl) ?? logoUrl : null;
  const initials = brandInitials(brandName || title);
  const platformList = Array.isArray(platforms) ? platforms.filter((p) => ["instagram", "tiktok", "youtube", "facebook"].includes(p)) : [];
  const imageLoading = priority ? "eager" : "lazy";
  const imagePriority = priority ? "high" : "auto";

  const logoMark = (sizeClass: string, textClass: string, onPhoto = false) => (
    <div
      className={`relative ${sizeClass} overflow-hidden rounded-2xl shadow-[0_8px_24px_rgba(0,0,0,0.28)] ring-1 ring-white/40 flex items-center justify-center ${
        logoSrc ? "bg-white" : onPhoto ? "bg-slate-950/70" : "bg-white/25"
      }`}
    >
      {logoSrc ? (
        // Same URL as the blurred backdrop — do not run it through a resizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoSrc}
          alt={brandName ? "" : "Brand"}
          className="absolute inset-0 h-full w-full object-contain p-[12%]"
          loading={imageLoading}
          decoding="async"
          fetchPriority={imagePriority}
          draggable={false}
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <span className={`${textClass} font-semibold tracking-wide text-white`}>{initials}</span>
      )}
    </div>
  );

  return (
    <div
      className={`relative w-full ${aspectClass} overflow-hidden ${
        desktopCap ? "lg:max-h-[var(--campaign-detail-cover-max-h,420px)]" : ""
      } ${
        hasCover ? `bg-gradient-to-br ${gradientFor(category)}` : "bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300"
      } ${className}`}
      style={
        desktopCap
          ? ({ ["--campaign-detail-cover-max-h"]: `${desktopCap}px` } as CSSProperties)
          : undefined
      }
    >
      {hasCover ? (
        <>
          {/* Soft letterbox fill: tiny downscaled source + modest blur (not full-res blur-2xl). */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {softFillCover ? (
              // eslint-disable-next-line @next/next/no-img-element -- intentional tiny soft-fill bitmap
              <img
                src={softFillCover}
                alt=""
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-80 [filter:blur(18px)]"
                loading={imageLoading}
                decoding="async"
                aria-hidden
              />
            ) : null}
            <div className="absolute inset-0 bg-slate-900/25" />
          </div>
          <FastImage
            src={displayCover as string}
            alt={title}
            fill
            className={desktopCap ? "object-contain lg:object-cover lg:object-center" : "object-contain"}
            sizes={sizes}
            priority={priority}
            onError={() => (useFallback ? setFallbackFailed(true) : setCoverFailed(true))}
          />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
          {showBrandMark ? (
            <div className="absolute left-3 bottom-3 z-10">{logoMark("w-14 h-14 sm:w-[4.5rem] sm:h-[4.5rem]", "text-lg", true)}</div>
          ) : null}
        </>
      ) : (
        // No image: neutral background; only the small brand logo bottom-left when the brand has one.
        showBrandMark && logoSrc ? (
          <div className="absolute left-3 bottom-3 z-10">{logoMark("w-14 h-14 sm:w-[4.5rem] sm:h-[4.5rem]", "text-lg", true)}</div>
        ) : null
      )}
      {platformList.length > 0 && (
        <div className="absolute right-3 bottom-3 z-20 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-slate-950/70 px-3 py-2 ring-1 ring-white/30 sm:min-h-0 sm:px-2.5 sm:py-1.5">
          {platformList.map((p) => (
            <PlatformIcon key={p} platform={p} colored={false} className="w-4 h-4" />
          ))}
        </div>
      )}
    </div>
  );
}
