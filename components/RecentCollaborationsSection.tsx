"use client";

import Link from "next/link";
import {
  useState,
  useSyncExternalStore,
} from "react";
import { SECTION_TITLE_CLASS } from "@/lib/sectionTitle";
import type { RecentCollaborationCard } from "@/lib/loadRecentCollaborations";
import CollaborationShowcaseCard from "@/components/CollaborationShowcaseCard";

type Lang = "el" | "en";

const COPY = {
  el: {
    title: "Πρόσφατες συνεργασίες",
    subtitle: "Ολοκληρωμένες συνεργασίες brands και creators — πραγματικό social proof.",
    seeAll: "Δείτε όλες τις συνεργασίες →",
    startCta: "Ξεκινήστε την καμπάνια σας",
    prev: "Προηγούμενες συνεργασίες",
    next: "Επόμενες συνεργασίες",
  },
  en: {
    title: "Recent collaborations",
    subtitle: "Completed brand–creator partnerships — real social proof.",
    seeAll: "See all collaborations →",
    startCta: "Start your campaign",
    prev: "Previous collaborations",
    next: "Next collaborations",
  },
} as const;

/** Matches Tailwind `md` and `.grid-collaboration-showcase` two-column breakpoint. */
const DESKTOP_MQ = "(min-width: 768px)";

function subscribeDesktop(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function desktopSnapshot() {
  return window.matchMedia(DESKTOP_MQ).matches;
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
 * Brand-facing recent collaborations: lazy embeds, carousel (desktop arrows),
 * honest self-reported metrics. Card size matches profile portfolio tiles.
 */
export default function RecentCollaborationsSection({
  items,
  lang,
  className = "",
  pageSize = 2,
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
  const pageIndex = Math.min(page, totalPages - 1);

  const start = pageIndex * safePageSize;
  const pageItems = items.slice(start, start + safePageSize);

  // One list for every viewport. Desktop pages in JS so we never mount a second
  // player per item (CSS `hidden` cannot beat an unlayered `display: grid`).
  const isDesktop = useSyncExternalStore(subscribeDesktop, desktopSnapshot, () => false);
  const visibleItems = isDesktop ? pageItems : items;

  if (!items.length) return null;

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
            onPrev={() => setPage((p) => Math.max(0, Math.min(p, totalPages - 1) - 1))}
            onNext={() => setPage((p) => Math.min(totalPages - 1, Math.min(p, totalPages - 1) + 1))}
            canPrev={pageIndex > 0}
            canNext={pageIndex < totalPages - 1}
          />
        ) : null}
      </div>

      <ul className="grid-collaboration-showcase mt-8">
        {visibleItems.map((item) => (
          <li key={item.id}>
            <CollaborationShowcaseCard item={item} lang={lang} variant="showcase" />
          </li>
        ))}
      </ul>

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