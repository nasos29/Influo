"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { SECTION_TITLE_CLASS } from "@/lib/sectionTitle";

const SCROLLBAR_HIDE =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const NAV_COPY = {
  prev: { el: "Προηγούμενοι", en: "Previous" },
  next: { el: "Επόμενοι", en: "Next" },
} as const;

export const INFLUENCER_CAROUSEL_CARD_CLASS =
  "w-[45%] shrink-0 snap-start md:w-[calc((100%-3*1.5rem)/4)]";

type Lang = "el" | "en";

function NavButtons({
  lang,
  onPrev,
  onNext,
  className = "",
}: {
  lang: Lang;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}) {
  return (
    <div className={`hidden shrink-0 items-center gap-2 md:flex ${className}`}>
      <button
        type="button"
        onClick={onPrev}
        aria-label={NAV_COPY.prev[lang]}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label={NAV_COPY.next[lang]}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Shared horizontal snap carousel used by SimilarInfluencers,
 * NewlyApprovedInfluencersSection, and TopInfluencersSection
 * (mobile ~2 visible, desktop 4 + ‹ ›).
 */
export default function InfluencerCardCarousel({
  lang,
  title,
  subtitle,
  eyebrow,
  loading = false,
  centerHeader = false,
  children,
  footer,
  className = "",
  titleClassName = SECTION_TITLE_CLASS,
  autoPlay = false,
  autoPlayInterval = 4000,
}: {
  lang: Lang;
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  loading?: boolean;
  /** Center eyebrow/title/subtitle; arrows overlay absolute so they do not shift the copy. */
  centerHeader?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  titleClassName?: string;
  /** When true, advances one card on an interval (Top 10 only). */
  autoPlay?: boolean;
  /** Ms between auto advances. Default 4000. */
  autoPlayInterval?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);
  const visibleRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  const autoPlayRef = useRef(autoPlay);
  const intervalRef = useRef(autoPlayInterval);
  autoPlayRef.current = autoPlay;
  intervalRef.current = autoPlayInterval;

  const clearAdvanceTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current != null) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const markProgrammaticScroll = useCallback(() => {
    programmaticScrollRef.current = true;
    window.setTimeout(() => {
      programmaticScrollRef.current = false;
    }, 600);
  }, []);

  const scrollByCard = useCallback(
    (dir: -1 | 1) => {
      const el = scrollerRef.current;
      if (!el) return;
      const card = el.querySelector<HTMLElement>("[data-carousel-card]");
      const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.5;
      markProgrammaticScroll();
      el.scrollBy({ left: dir * step, behavior: "smooth" });
    },
    [markProgrammaticScroll]
  );

  const advanceAuto = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-carousel-card]");
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.5;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 2) return;
    markProgrammaticScroll();
    // At (or past) last snap: smoothly loop back to #1.
    if (el.scrollLeft >= maxScroll - 4) {
      el.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    const next = el.scrollLeft + step;
    if (next >= maxScroll - 4) {
      el.scrollTo({ left: maxScroll, behavior: "smooth" });
    } else {
      el.scrollBy({ left: step, behavior: "smooth" });
    }
  }, [markProgrammaticScroll]);

  const scheduleAdvance = useCallback(() => {
    clearAdvanceTimer();
    if (
      !autoPlayRef.current ||
      reducedMotionRef.current ||
      !visibleRef.current ||
      pausedRef.current ||
      loading
    ) {
      return;
    }
    timerRef.current = setTimeout(() => {
      advanceAuto();
      scheduleAdvance();
    }, intervalRef.current);
  }, [advanceAuto, clearAdvanceTimer, loading]);

  const pauseAuto = useCallback(() => {
    pausedRef.current = true;
    clearAdvanceTimer();
    clearResumeTimer();
  }, [clearAdvanceTimer, clearResumeTimer]);

  const resumeAutoAfterIdle = useCallback(() => {
    clearResumeTimer();
    resumeTimerRef.current = setTimeout(() => {
      pausedRef.current = false;
      scheduleAdvance();
    }, intervalRef.current);
  }, [clearResumeTimer, scheduleAdvance]);

  const onNav = useCallback(
    (dir: -1 | 1) => {
      scrollByCard(dir);
      // Restart countdown; keep paused if user is still hovering/touching/focused.
      clearAdvanceTimer();
      clearResumeTimer();
      if (!pausedRef.current) scheduleAdvance();
    },
    [scrollByCard, clearAdvanceTimer, clearResumeTimer, scheduleAdvance]
  );

  useEffect(() => {
    if (!autoPlay || loading) {
      clearAdvanceTimer();
      clearResumeTimer();
      return;
    }

    const root = rootRef.current;
    if (!root) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    const onMotionChange = () => {
      reducedMotionRef.current = mq.matches;
      if (mq.matches) {
        clearAdvanceTimer();
        clearResumeTimer();
      } else {
        scheduleAdvance();
      }
    };
    mq.addEventListener("change", onMotionChange);

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        visibleRef.current = !!entry?.isIntersecting;
        if (visibleRef.current) scheduleAdvance();
        else clearAdvanceTimer();
      },
      { threshold: 0.25 }
    );
    io.observe(root);

    const onVisibility = () => {
      if (document.hidden) {
        pauseAuto();
      } else {
        resumeAutoAfterIdle();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onPointerEnter = () => pauseAuto();
    const onPointerLeave = () => resumeAutoAfterIdle();
    const onFocusIn = () => pauseAuto();
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (next && root.contains(next)) return;
      resumeAutoAfterIdle();
    };
    const onTouchStart = () => pauseAuto();
    const onTouchEnd = () => resumeAutoAfterIdle();
    const onTouchCancel = () => resumeAutoAfterIdle();

    root.addEventListener("pointerenter", onPointerEnter);
    root.addEventListener("pointerleave", onPointerLeave);
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchend", onTouchEnd, { passive: true });
    root.addEventListener("touchcancel", onTouchCancel, { passive: true });

    const scroller = scrollerRef.current;
    const onUserScroll = () => {
      if (programmaticScrollRef.current) return;
      pauseAuto();
      resumeAutoAfterIdle();
    };
    scroller?.addEventListener("scroll", onUserScroll, { passive: true });

    scheduleAdvance();

    return () => {
      mq.removeEventListener("change", onMotionChange);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeEventListener("pointerenter", onPointerEnter);
      root.removeEventListener("pointerleave", onPointerLeave);
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("touchcancel", onTouchCancel);
      scroller?.removeEventListener("scroll", onUserScroll);
      clearAdvanceTimer();
      clearResumeTimer();
    };
  }, [
    autoPlay,
    loading,
    scheduleAdvance,
    pauseAuto,
    resumeAutoAfterIdle,
    clearAdvanceTimer,
    clearResumeTimer,
  ]);

  const titleBlock = (
    <>
      {eyebrow ? <div className="mb-3">{eyebrow}</div> : null}
      <h2 className={`${titleClassName}${subtitle ? " mb-3" : ""}`}>{title}</h2>
      {subtitle ? (
        <div className="text-slate-600 text-sm sm:text-base">{subtitle}</div>
      ) : null}
    </>
  );

  return (
    <div ref={rootRef} className={className}>
      {centerHeader ? (
        <div className="relative mb-4 md:px-24">
          <div className="mx-auto max-w-2xl text-center">{titleBlock}</div>
          {!loading ? (
            <NavButtons
              lang={lang}
              onPrev={() => onNav(-1)}
              onNext={() => onNav(1)}
              className="absolute right-0 bottom-0"
            />
          ) : null}
        </div>
      ) : (
        <div className="mb-4 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">{titleBlock}</div>
          {!loading ? (
            <NavButtons
              lang={lang}
              onPrev={() => onNav(-1)}
              onNext={() => onNav(1)}
            />
          ) : null}
        </div>
      )}

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
