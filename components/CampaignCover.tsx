"use client";

import { useState } from "react";
import FastImage from "@/components/FastImage";
import { getCachedImageUrl } from "@/lib/imageProxy";

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
  title,
  brandName,
  logoUrl,
  category,
  platforms,
  aspect = "4/3",
  className = "",
  sizes = "(max-width: 768px) 100vw, 400px",
  priority = false,
}: {
  coverUrl?: string | null;
  title: string;
  brandName?: string | null;
  logoUrl?: string | null;
  category?: string | null;
  platforms?: string[] | null;
  aspect?: "4/3" | "16/9";
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const aspectClass = aspect === "16/9" ? "aspect-video" : "aspect-[4/3]";
  const hasCover = Boolean(coverUrl) && !coverFailed;
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
        logoSrc ? "bg-white/10" : onPhoto ? "bg-slate-950/55 backdrop-blur-md" : "bg-white/15 backdrop-blur-sm"
      }`}
    >
      {logoSrc ? (
        // Same URL as the blurred backdrop — do not run it through a resizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoSrc}
          alt={brandName ? "" : "Brand"}
          className="absolute inset-0 h-full w-full object-cover"
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
        hasCover ? `bg-gradient-to-br ${gradientFor(category)}` : logoSrc ? "bg-slate-800" : "bg-gradient-to-br from-slate-500 via-slate-600 to-slate-700"
      } ${className}`}
    >
      {hasCover ? (
        <>
          <FastImage
            src={coverUrl as string}
            alt={title}
            fill
            className="object-cover"
            sizes={sizes}
            priority={priority}
            onError={() => setCoverFailed(true)}
          />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
          <div className="absolute left-3 bottom-3 z-10">{logoMark("w-10 h-10 sm:w-12 sm:h-12", "text-base", true)}</div>
        </>
      ) : (
        <>
          {logoSrc ? (
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt=""
                className="absolute inset-0 h-full w-full origin-center scale-[1.35] object-cover blur-[36px]"
                loading={imageLoading}
                decoding="async"
                fetchPriority={imagePriority}
                draggable={false}
                onError={() => setLogoFailed(true)}
              />
              <div className="absolute inset-0 bg-black/40" />
            </div>
          ) : (
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(255,255,255,0.18),transparent_42%),radial-gradient(circle_at_82%_84%,rgba(15,23,42,0.18),transparent_46%)]"
              aria-hidden
            />
          )}
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-4">
            {logoMark("w-16 h-16 sm:w-20 sm:h-20", "text-2xl sm:text-3xl")}
            {brandName ? (
              <p className="max-w-full truncate text-sm font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
                {brandName}
              </p>
            ) : null}
          </div>
        </>
      )}
      {platformList.length > 0 && (
        <div className="absolute right-3 bottom-3 z-20 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-slate-950/50 px-3 py-2 ring-1 ring-white/30 backdrop-blur-md sm:min-h-0 sm:px-2.5 sm:py-1.5">
          {platformList.map((p) => (
            <PlatformIcon key={p} platform={p} colored={false} className="w-4 h-4" />
          ))}
        </div>
      )}
    </div>
  );
}
