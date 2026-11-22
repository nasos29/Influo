"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { SECTION_TITLE_CLASS } from "@/lib/sectionTitle";
import type { RecentCollaborationCard } from "@/lib/loadRecentCollaborations";
import { getCachedImageUrl } from "@/lib/imageProxy";
import { displayServiceType } from "@/lib/campaignServiceLabel";

const SocialEmbedCard = dynamic(() => import("@/components/SocialEmbedCard"), {
  ssr: false,
  loading: () => (
    <div className="aspect-[4/5] w-full animate-pulse rounded-xl bg-slate-100" aria-hidden />
  ),
});

type Lang = "el" | "en";

const COPY = {
  el: {
    title: "Πρόσφατες συνεργασίες",
    subtitle: "Ολοκληρωμένες συνεργασίες brands και creators — πραγματικό social proof.",
    reported: "δηλωμένα",
    views: "προβολές",
    reach: "reach",
    seeAll: "Δείτε όλες τις συνεργασίες →",
    startCta: "Ξεκινήστε την καμπάνια σας",
    prev: "Προηγούμενες συνεργασίες",
    next: "Επόμενες συνεργασίες",
    openPost: "Άνοιγμα post",
  },
  en: {
    title: "Recent collaborations",
    subtitle: "Completed brand–creator partnerships — real social proof.",
    reported: "self-reported",
    views: "views",
    reach: "reach",
    seeAll: "See all collaborations →",
    startCta: "Start your campaign",
    prev: "Previous collaborations",
    next: "Next collaborations",
    openPost: "Open post",
  },
} as const;

const PLATFORM_LABEL: Record<NonNullable<RecentCollaborationCard["postProvider"]>, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

function Avatar({
  src,
  name,
  size,
  rounded = "full",
}: {
  src: string | null;
  name: string;
  size: number;
  rounded?: "full" | "lg";
}) {
  const proxied = src ? getCachedImageUrl(src) : null;
  const radius = rounded === "lg" ? "rounded-lg" : "rounded-full";
  if (proxied) {
    return (
      <Image
        src={proxied}
        alt={name}
        width={size}
        height={size}
        className={`h-full w-full object-cover ${radius}`}
        loading="lazy"
        unoptimized={proxied.startsWith("/api/image-proxy")}
      />
    );
  }
  return (
    <span
      className={`flex h-full w-full items-center justify-center bg-slate-200 text-sm font-semibold text-slate-600 ${radius}`}
    >
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

function ResultLine({
  item,
  lang,
}: {
  item: RecentCollaborationCard;
  lang: Lang;
}) {
  const txt = COPY[lang];
  const locale = lang === "el" ? "el-GR" : "en-GB";
  const parts: string[] = [];
  if (item.selfReportedViews != null) {
    parts.push(`${item.selfReportedViews.toLocaleString(locale)} ${txt.views}`);
  }
  if (item.selfReportedReach != null) {
    parts.push(`${item.selfReportedReach.toLocaleString(locale)} ${txt.reach}`);
  }
  if (!parts.length) return null;
  return (
    <p className="text-xs text-slate-500">
      {parts.join(" · ")}{" "}
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
        {txt.reported}
      </span>
    </p>
  );
}

function CollaborationCard({
  item,
  lang,
}: {
  item: RecentCollaborationCard;
  lang: Lang;
}) {
  const txt = COPY[lang];
  const categoryLabel = item.category
    ? displayServiceType(item.category, lang) || item.category
    : null;
  const platform = item.postProvider ? PLATFORM_LABEL[item.postProvider] : null;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow duration-200 hover:shadow-md">
      <div className="relative bg-slate-50">
        <div className="aspect-[4/5] w-full overflow-hidden">
          {item.postUrl && item.postProvider ? (
            <SocialEmbedCard
              provider={item.postProvider}
              originalUrl={item.postUrl}
              lang={lang}
              hostedMedia={item.hostedMedia ?? null}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-sm text-slate-500">
              {item.brandName}
            </div>
          )}
        </div>
        {platform ? (
          <span className="absolute left-3 top-3 rounded-md bg-white/60 px-2 py-1 text-[11px] font-semibold tracking-wide text-slate-800 shadow-sm backdrop-blur-sm ring-1 ring-white/40">
            {platform}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <Avatar src={item.brandLogoUrl} name={item.brandName} size={44} rounded="lg" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{item.brandName}</p>
            {categoryLabel ? (
              <p className="truncate text-xs text-slate-500">{categoryLabel}</p>
            ) : null}
          </div>
        </div>

        <Link
          href={item.influencerProfileHref}
          className="flex min-w-0 items-center gap-3 rounded-lg outline-offset-2 hover:bg-slate-50"
        >
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-100">
            <Avatar src={item.influencerAvatarUrl} name={item.influencerName} size={40} />
          </div>
          <span className="truncate font-medium text-slate-800 hover:underline">
            {item.influencerName}
          </span>
        </Link>

        <div className="mt-auto space-y-2">
          <ResultLine item={item} lang={lang} />
          {item.postUrl ? (
            <a
              href={item.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-xs font-medium text-slate-600 underline-offset-2 hover:underline"
            >
              {txt.openPost}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function NavButtons({
  lang,
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  lang: Lang;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  const txt = COPY[lang];
  const btnClass =
    "inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:cursor-default disabled:opacity-35 disabled:hover:border-slate-200 disabled:hover:bg-white";
  return (
    <div className="hidden shrink-0 items-center gap-2 md:flex">
      <button type="button" onClick={onPrev} disabled={!canPrev} aria-label={txt.prev} className={btnClass}>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button type="button" onClick={onNext} disabled={!canNext} aria-label={txt.next} className={btnClass}>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Brand-facing recent collaborations: lazy embeds, carousel (desktop arrows /
 * mobile swipe), honest self-reported metrics.
 */
export default function RecentCollaborationsSection({
  items,
  lang,
  className = "",
  pageSize = 3,
  showSeeAll = true,
  showStartCta = false,
}: {
  items: RecentCollaborationCard[];
  lang: Lang;
  className?: string;
  pageSize?: number;
  showSeeAll?: boolean;
  showStartCta?: boolean;
}) {
  const txt = COPY[lang];
  const safePageSize = Math.max(1, Math.min(4, Math.floor(pageSize)));
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
  const showArrows = items.length > safePageSize;

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages - 1));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const start = page * safePageSize;
    return items.slice(start, start + safePageSize);
  }, [items, page, safePageSize]);

  if (!items.length) return null;

  const style = {
    ["--home-collab-cols"]: safePageSize,
  } as CSSProperties;

  const collabHref = lang === "en" ? "/en/collaborations" : "/collaborations";
  const ctaHref = lang === "en" ? "/en/for-brands" : "/for-brands";

  return (
    <section className={`w-full max-w-page mx-auto px-6 py-12 md:py-16 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h2 className={SECTION_TITLE_CLASS}>{txt.title}</h2>
          <p className="mt-2 text-slate-600">{txt.subtitle}</p>
        </div>
        {showArrows ? (
          <NavButtons
            lang={lang}
            onPrev={() => setPage((p) => Math.max(0, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            canPrev={page > 0}
            canNext={page < totalPages - 1}
          />
        ) : null}
      </div>

      {/* Mobile: horizontal snap swipe */}
      <div className="mt-8 md:hidden">
        <ul className="grid-home-collaborations">
          {items.map((item) => (
            <li key={item.id} className="min-w-0">
              <CollaborationCard item={item} lang={lang} />
            </li>
          ))}
        </ul>
      </div>

      {/* Desktop: paged equal-width row */}
      <div className="mt-8 hidden md:block">
        <ul className="grid-home-collaborations" style={style}>
          {pageItems.map((item) => (
            <li key={item.id} className="min-w-0 h-full">
              <CollaborationCard item={item} lang={lang} />
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        {showSeeAll ? (
          <Link
            href={collabHref}
            className="text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
          >
            {txt.seeAll}
          </Link>
        ) : null}
        {showStartCta ? (
          <Link
            href={ctaHref}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            {txt.startCta}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
