"use client";

import type { ReactElement } from "react";
import { Badge } from "../lib/badges";
import Avatar from "./Avatar";
import { categoryTranslations } from "./categoryTranslations";
import { displayNameForLang } from "@/lib/greeklish";
import { getCachedImageUrl, getStorageCardUrl } from "@/lib/imageProxy";
import { formatPriceTierLabel } from "@/lib/publicInfluencer";
import type { TrustChip } from "@/lib/trustSignals";
import { isAvailableStatus } from "@/lib/trustSignals";

interface InfluencerCardProps {
  name: string;
  bio?: string;
  bio_en?: string | null;
  avatar: string;
  verified: boolean;
  socials: { [key: string]: string | undefined };
  followers: { [key: string]: number | undefined };
  categories?: string[];
  languages?: string[];
  badges?: Badge[];
  lang?: "el" | "en";
  trustChips?: TrustChip[];
  availabilityStatus?: string | null;
  location?: string | null;
  price_tier?: string | null;
}

const InstagramIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);
const TiktokIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);
const YoutubeIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);
const TwitterIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c1 1 2.45 1.53 4 1.53a10.66 10.66 0 0 0 10-5.83v-.57a4.48 4.48 0 0 0 2-1.39z" />
  </svg>
);

const PLATFORM_META: {
  key: string;
  Icon: (props: { className?: string }) => ReactElement;
}[] = [
  { key: "instagram", Icon: InstagramIcon },
  { key: "tiktok", Icon: TiktokIcon },
  { key: "youtube", Icon: YoutubeIcon },
  { key: "twitter", Icon: TwitterIcon },
];

const formatNum = (num?: number) => {
  if (num === undefined || num === null) return "";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return num.toString();
};

function topPlatform(followers: { [key: string]: number | undefined }) {
  let best: { key: string; count: number } | null = null;
  for (const { key } of PLATFORM_META) {
    const count = followers[key];
    if (typeof count !== "number" || !(count > 0)) continue;
    if (!best || count > best.count) best = { key, count };
  }
  // Also allow any other key present in followers
  if (!best) {
    for (const [key, count] of Object.entries(followers || {})) {
      if (typeof count !== "number" || !(count > 0)) continue;
      if (!best || count > best.count) best = { key, count };
    }
  }
  return best;
}

export default function InfluencerCard({
  name,
  avatar,
  verified,
  followers,
  categories = [],
  badges = [],
  lang = "el",
  trustChips = [],
  availabilityStatus,
  location,
  price_tier,
}: InfluencerCardProps) {
  const available = isAvailableStatus(availabilityStatus);
  const displayName = displayNameForLang(name, lang || "el");
  const cardUrl = avatar ? getStorageCardUrl(avatar, 480, 600) : null;
  const photoSrc = cardUrl ? getCachedImageUrl(cardUrl) ?? cardUrl : null;
  const priceLabel = formatPriceTierLabel(price_tier);
  const top = topPlatform(followers);
  const TopIcon = top
    ? PLATFORM_META.find((p) => p.key === top.key)?.Icon ?? InstagramIcon
    : null;

  const categoryLine = categories
    .slice(0, 2)
    .map((cat) => categoryTranslations[cat]?.[lang] || cat)
    .filter(Boolean)
    .join(" · ");

  // One overlay pill: unavailable → first badge → first trust chip
  let overlayPill: { key: string; text: string; title?: string } | null = null;
  if (!available) {
    overlayPill = {
      key: "unavailable",
      text: lang === "el" ? "Μη διαθέσιμος" : "Unavailable",
      title: lang === "el" ? "Μη διαθέσιμος προσωρινά" : "Temporarily unavailable",
    };
  } else if (badges[0]) {
    overlayPill = {
      key: `badge-${badges[0].type}`,
      text: `${badges[0].icon} ${badges[0].label}`.trim(),
      title: badges[0].label,
    };
  } else if (trustChips[0]) {
    const chip = trustChips[0];
    overlayPill = {
      key: `trust-${chip.kind}`,
      text: lang === "el" ? chip.labelEl : chip.labelEn,
      title: lang === "el" ? chip.titleEl : chip.titleEn,
    };
  }

  return (
    <div className="group h-full flex flex-col cursor-pointer">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-slate-100">
        {photoSrc ? (
          <img
            src={photoSrc}
            alt={displayName}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
            <Avatar src={avatar} alt={displayName} size={96} />
          </div>
        )}

        {overlayPill && (
          <div className="absolute top-2.5 right-2.5 z-10 max-w-[70%]">
            <span
              title={overlayPill.title}
              className="inline-flex max-w-full items-center truncate rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-slate-800 shadow-sm backdrop-blur-sm"
            >
              {overlayPill.text}
            </span>
          </div>
        )}

        {top && TopIcon && (
          <div className="absolute bottom-2.5 left-2.5 z-10">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              <TopIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{formatNum(top.count)}</span>
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <h4 className="truncate text-sm font-semibold text-slate-900 sm:text-base">
            {displayName}
          </h4>
          {verified && (
            <span
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"
              title={lang === "en" ? "Stats checked by Influo" : "Στατιστικά ελεγμένα από το Influo"}
            >
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
        </div>

        {categoryLine ? (
          <p className="truncate text-xs text-slate-500 sm:text-sm">{categoryLine}</p>
        ) : null}

        {(location || priceLabel) && (
          <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-slate-600 sm:text-sm">
            <span className="min-w-0 truncate">
              {location ? (
                <>
                  <span aria-hidden>📍</span> {location}
                </>
              ) : (
                <span className="invisible">-</span>
              )}
            </span>
            {priceLabel ? (
              <span className="shrink-0 font-medium text-slate-700">{priceLabel}</span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
