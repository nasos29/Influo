"use client";

import { useCallback, useRef, type ReactNode } from "react";

const SCROLLBAR_HIDE =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const NAV_COPY = {
  prev: { el: "Προηγούμενοι", en: "Previous" },
  next: { el: "Επόμενοι", en: "Next" },
} as const;

export const INFLUENCER_CAROUSEL_CARD_CLASS =
  "w-[45%] shrink-0 snap-start md:w-[calc((100%-3*1.5rem)/4)]";

type Lang = "el" | "en";

/**
 * Shared horizontal snap carousel used by SimilarInfluencers and
 * NewlyApprovedInfluencersSection (mobile ~2 visible, desktop 4 + ‹ ›).
 */
export default function InfluencerCardCarousel({
  lang,
  title,
  subtitle,
  eyebrow,
  loading = false,
  children,
  footer,
  className = "",
  titleClassName = "min-w-0 flex-1 text-lg font-bold text-slate-900 break-words sm:text-xl md:text-2xl",
}: {
  lang: Lang;
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  loading?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  titleClassName?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollByCard = useCallback((dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-carousel-card]");
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.5;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }, []);

  return (
    <div className={className}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}
          <div className={titleClassName}>{title}</div>
          {subtitle ? <div className="mt-2 text-slate-600 text-sm sm:text-base">{subtitle}</div> : null}
        </div>
        {!loading ? (
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <button
              type="button"
              onClick={() => scrollByCard(-1)}
              aria-label={NAV_COPY.prev[lang]}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => scrollByCard(1)}
              aria-label={NAV_COPY.next[lang]}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className={`flex gap-4 overflow-hidden md:gap-6 ${SCROLLBAR_HIDE}`} aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={INFLUENCER_CAROUSEL_CARD_CLASS}>
              <div className="aspect-[4/5] rounded-2xl bg-slate-100 animate-pulse" />
              <div className="mt-3 h-4 w-3/4 rounded bg-slate-100 animate-pulse" />
              <div className="mt-2 h-3 w-1/2 rounded bg-slate-100 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={scrollerRef}
          className={`flex gap-4 overflow-x-auto snap-x snap-mandatory pb-1 md:gap-6 ${SCROLLBAR_HIDE}`}
        >
          {children}
        </div>
      )}

      {footer ? <div className="mt-6">{footer}</div> : null}
    </div>
  );
}
