"use client";

import type { ReactElement } from "react";
import { Badge, getBadgeStyles } from "../lib/badges";
import Avatar from "./Avatar";
import { categoryTranslations } from "./categoryTranslations";
import { displayNameForLang } from "@/lib/greeklish";
import { getCachedImageUrl, getStorageCardUrl } from "@/lib/imageProxy";
import { formatFromPriceLabel } from "@/lib/publicInfluencer";
import { displayLocation } from "@/lib/displayLocation";
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
  /** Exact lowest price. Shown as «Από X €» / «From X €». */
  from_price?: number | null;
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

/**
 * Connected platforms (from socials and/or followers), sorted by followers desc.
 * Known platforms keep a stable tie-break order.
 */
function rankedPlatforms(
  followers: { [key: string]: number | undefined },
  socials: { [key: string]: string | undefined }
) {
  const knownOrder = new Map(PLATFORM_META.map((p, i) => [p.key, i]));
  const keys = new Set<string>();
  for (const { key } of PLATFORM_META) {
    if (socials[key] || (typeof followers[key] === "number" && (followers[key] as number) > 0)) {
      keys.add(key);
    }
  }
  for (const [key, username] of Object.entries(socials || {})) {
    if (username) keys.add(key);
  }
  for (const [key, count] of Object.entries(followers || {})) {
    if (typeof count === "number" && count > 0) keys.add(key);
  }

  const entries = [...keys].map((key) => ({
    key,
    count: typeof followers[key] === "number" ? (followers[key] as number) : 0,
  }));

  entries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return (knownOrder.get(a.key) ?? 99) - (knownOrder.get(b.key) ?? 99);
  });
  return entries;
}

function PlatformPill({
  platformKey,
  count,
}: {
  platformKey: string;
  count: number;
}) {
  const Icon = PLATFORM_META.find((p) => p.key === platformKey)?.Icon ?? InstagramIcon;
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm sm:gap-1 sm:px-2 sm:py-1 sm:text-[11px]">
      <Icon className="h-2.5 w-2.5 shrink-0 sm:h-3.5 sm:w-3.5" />
      <span className="tabular-nums">{formatNum(count)}</span>
    </span>
  );
}

export default function InfluencerCard({
  name,
  avatar,
  verified,
  socials,
  followers,
  categories = [],
  badges = [],
  lang = "el",
  trustChips = [],
  availabilityStatus,
  location,
  from_price,
}: InfluencerCardProps) {
  const available = isAvailableStatus(availabilityStatus);
  const displayName = displayNameForLang(name, lang || "el");
  const cardUrl = avatar ? getStorageCardUrl(avatar, 480, 600) : null;
  const photoSrc = cardUrl ? getCachedImageUrl(cardUrl) ?? cardUrl : null;
  const priceLabel = formatFromPriceLabel(from_price, lang === "en" ? "en" : "el");
  const ranked = rankedPlatforms(followers, socials);

  const categoryLine = categories
    .slice(0, 2)
    .map((cat) => categoryTranslations[cat]?.[lang] || cat)
    .filter(Boolean)
    .join(" · ");

  // One top-right overlay: unavailable → first badge → first trust chip (original colors).
  let overlay: ReactElement | null = null;
  if (!available) {
    overlay = (
      <span
        className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200/80 sm:px-2.5 sm:py-1"
        title={lang === "el" ? "Μη διαθέσιμος προσωρινά" : "Temporarily unavailable"}
      >
        {lang === "el" ? "Μη διαθέσιμος" : "Unavailable"}
      </span>
    );
  } else if (badges[0]) {
    const badge = badges[0];
    overlay = (
      <span className={getBadgeStyles(badge)} title={badge.label}>
        <span className="text-[10px]">{badge.icon}</span>
        <span className="text-[9px] leading-none">{badge.label}</span>
      </span>
    );
  } else if (trustChips[0]) {
    const chip = trustChips[0];
    overlay = (
      <span
        title={lang === "el" ? chip.titleEl : chip.titleEn}
        className={
          chip.kind === "private"
            ? "inline-flex items-center rounded-full bg-slate-800/90 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white sm:px-2.5 sm:py-1"
            : "inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200/80 sm:px-2.5 sm:py-1"
        }
      >
        {lang === "el" ? chip.labelEl : chip.labelEn}
      </span>
    );
  }

  let platformRow: ReactElement | null = null;
  if (ranked.length === 1) {
    platformRow = (
      <div className="flex justify-start">
        <PlatformPill platformKey={ranked[0]!.key} count={ranked[0]!.count} />
      </div>
    );
  } else if (ranked.length === 2 || ranked.length === 3) {
    platformRow = (
      <div className="flex items-end justify-between gap-1">
        {ranked.map((p) => (
          <PlatformPill key={p.key} platformKey={p.key} count={p.count} />
        ))}
      </div>
    );
  } else if (ranked.length > 3) {
    platformRow = (
      <div className="flex items-end justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1">
          {ranked.slice(0, 2).map((p) => (
            <PlatformPill key={p.key} platformKey={p.key} count={p.count} />
          ))}
        </div>
        <span className="inline-flex items-center rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm sm:px-2 sm:py-1 sm:text-[11px]">
          +{ranked.length - 2}
        </span>
      </div>
    );
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

        {overlay && (
          <div className="absolute top-2 right-2 z-10 max-w-[70%]">{overlay}</div>
        )}

        {platformRow && (
          <div className="absolute inset-x-0 bottom-0 z-10 px-2 pb-2 sm:px-2.5 sm:pb-2.5">
            {platformRow}
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
                  <span aria-hidden>📍</span> {displayLocation(location, lang) || location}
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
