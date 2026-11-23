"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import CountUp from "@/components/CountUp";
import { getCachedImageUrl } from "@/lib/imageProxy";
import HostedMediaPlayer from "@/components/HostedMediaPlayer";
import { isHostedPhotoMedia } from "@/lib/hostedMediaRender";
import type {
  FeaturedCollaborationPlatform,
  FeaturedCollaborationsShowcaseData,
} from "@/lib/loadFeaturedCollaborations";

type Lang = "el" | "en";

const COPY = {
  el: {
    with: "με",
    unmute: "Ήχος",
    mute: "Σίγαση",
    playVideo: "Δες το βίντεο",
    seek: "Γραμμή προόδου βίντεο",
    publicViewsLead: "Ήδη",
    publicViews: "προβολές",
    thumbsPrev: "Προηγούμενα βίντεο",
    thumbsNext: "Επόμενα βίντεο",
  },
  en: {
    with: "with",
    unmute: "Sound",
    mute: "Mute",
    playVideo: "Play video",
    seek: "Video progress",
    publicViewsLead: "Already",
    publicViews: "views",
    thumbsPrev: "Previous videos",
    thumbsNext: "Next videos",
  },
} as const;

const THUMBS_SCROLLBAR_HIDE =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Hero + thumbs in one row (desktop-style). Portrait phones (<640px) use stacked layout; keep JS matchMedia in sync. */
const SHOWCASE_ROW_MIN_WIDTH_PX = 640;
const SHOWCASE_ROW_MQ = `(min-width: ${SHOWCASE_ROW_MIN_WIDTH_PX}px)`;

const SHOWCASE_LANDSCAPE_SHORT =
  "[@media(orientation:landscape)_and_(max-height:32rem)]:sm:h-[min(50dvh,18rem)]";
const SHOWCASE_THUMB_LANDSCAPE_SHORT =
  "[@media(orientation:landscape)_and_(max-height:32rem)]:sm:h-[min(40dvh,14.4rem)]";

const PLATFORM_LABEL: Record<FeaturedCollaborationPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};

type Props = {
  data: FeaturedCollaborationsShowcaseData;
  lang: Lang;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatPerVideoViews(views: number, lang: Lang): string {
  const locale = lang === "el" ? "el-GR" : "en-GB";
  const formatted = new Intl.NumberFormat(locale).format(views);
  return lang === "el" ? `${formatted} προβολές` : `${formatted} views`;
}

const VIEWS_BADGE_CLASS =
  "absolute top-3 right-3 z-[7] rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-white backdrop-blur-sm sm:text-[11px]";

/** Pause, mute, and tear down decoder so unmounted/stale elements cannot keep playing audio. */
function releaseVideoMedia(el: HTMLVideoElement) {
  el.pause();
  el.muted = true;
  el.removeAttribute("src");
  el.load();
}

function CreatorMiniAvatar({ src, name }: { src: string | null; name: string }) {
  const proxied = src ? getCachedImageUrl(src) : null;
  if (proxied) {
    return (
      <Image
        src={proxied}
        alt={name}
        width={28}
        height={28}
        className="w-7 h-7 shrink-0 rounded-full object-cover ring-1 ring-white/30"
        loading="lazy"
        unoptimized={proxied.startsWith("/api/image-proxy")}
      />
    );
  }
  return (
    <span className="flex w-7 h-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-semibold text-white ring-1 ring-white/30">
      {(name || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

const TOUCH_CHROME_HIDE_MS = 2500;

/** Fine-pointer desktops: fade chrome when pointer leaves hero; touch uses JS chrome visibility. */
const HERO_IDLE_HIDE_FINE =
  "transition-opacity duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-[:not(:hover)]/hero:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-[:not(:hover)]/hero:pointer-events-none";

/** Fine-pointer idle: name only at bottom-left; coarse touch uses JS when chrome is hidden. */
const HERO_IDLE_NAME_FINE =
  "opacity-0 pointer-events-none transition-opacity duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-[:not(:hover)]/hero:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-[:not(:hover)]/hero:pointer-events-auto";

function heroCoarseChromeHideClass(coarseChromeHidden: boolean) {
  return coarseChromeHidden ? "opacity-0 pointer-events-none" : "";
}

function heroCoarseNameIdleClass(isFinePointer: boolean, coarseChromeHidden: boolean) {
  if (isFinePointer) return HERO_IDLE_NAME_FINE;
  return coarseChromeHidden
    ? "pointer-events-auto opacity-100 transition-opacity duration-200"
    : "pointer-events-none opacity-0 transition-opacity duration-200";
}

function CreatorProfileLink({
  name,
  href,
  avatarUrl,
  platform,
  className = "",
  onClick,
  hideAvatarOnHeroIdle = false,
}: {
  name: string;
  href: string;
  avatarUrl: string | null;
  platform?: FeaturedCollaborationPlatform | null;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  hideAvatarOnHeroIdle?: boolean;
}) {
  const platformLabel = platform ? PLATFORM_LABEL[platform] : null;
  const avatarIdleCollapse = hideAvatarOnHeroIdle
    ? "[@media(hover:hover)_and_(pointer:fine)]:group-[:not(:hover)]/hero:hidden"
    : "";
  return (
    <div className={`min-w-0 ${className}`}>
      <Link
        href={href}
        className="inline-flex min-w-0 items-center gap-2 text-white text-xs font-semibold drop-shadow-sm hover:underline underline-offset-2 sm:text-sm"
        onClick={onClick}
      >
        <span className={avatarIdleCollapse}>
          <CreatorMiniAvatar src={avatarUrl} name={name} />
        </span>
        <span className="truncate">{name}</span>
      </Link>
      {platformLabel ? (
        <p
          className={`mt-0.5 pl-9 text-[10px] font-medium text-white/80 truncate sm:text-[11px] ${hideAvatarOnHeroIdle ? HERO_IDLE_HIDE_FINE : ""}`}
        >
          {platformLabel}
        </p>
      ) : null}
    </div>
  );
}

function CreatorLinkOverlay({
  name,
  href,
  avatarUrl,
  platform,
  className = "",
  isFinePointer = true,
  coarseChromeHidden = false,
}: {
  name: string;
  href: string;
  avatarUrl: string | null;
  platform?: FeaturedCollaborationPlatform | null;
  className?: string;
  isFinePointer?: boolean;
  coarseChromeHidden?: boolean;
}) {
  const coarseHide = heroCoarseChromeHideClass(coarseChromeHidden);
  return (
    <>
      <div
        className={`absolute inset-x-0 z-[5] px-3 pt-16 bg-gradient-to-t from-black/80 via-black/45 to-transparent pointer-events-none ${HERO_IDLE_HIDE_FINE} ${coarseHide} ${className}`}
        aria-hidden
      />
      <div
        className={`absolute inset-x-0 z-[5] px-3 pointer-events-none ${HERO_IDLE_HIDE_FINE} ${coarseHide} ${className}`}
      >
        <CreatorProfileLink
          name={name}
          href={href}
          avatarUrl={avatarUrl}
          platform={platform}
          className="pointer-events-auto max-w-full"
          hideAvatarOnHeroIdle
        />
      </div>
      <Link
        href={href}
        className={`absolute bottom-3 left-3 z-[5] max-w-[calc(100%-1.5rem)] truncate text-xs font-semibold text-white sm:text-sm [text-shadow:0_1px_3px_rgba(0,0,0,0.85),0_0_8px_rgba(0,0,0,0.45)] hover:underline underline-offset-2 ${heroCoarseNameIdleClass(isFinePointer, coarseChromeHidden)}`}
      >
        {name}
      </Link>
    </>
  );
}

function HeroSeekBar({
  videoRef,
  lang,
  className = "",
  coarseChromeHidden = false,
  onChromeInteraction,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  lang: Lang;
  className?: string;
  coarseChromeHidden?: boolean;
  onChromeInteraction?: () => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const seekingRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const txt = COPY[lang];

  const seekTo = useCallback(
    (t: number) => {
      const el = videoRef.current;
      if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
      const clamped = Math.min(Math.max(0, t), el.duration);
      el.currentTime = clamped;
      setCurrentTime(clamped);
    },
    [videoRef]
  );

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const el = videoRef.current;
      const bar = barRef.current;
      if (!el || !bar || !Number.isFinite(el.duration) || el.duration <= 0) return 0;
      const rect = bar.getBoundingClientRect();
      const ratio =
        rect.width <= 0 ? 0 : Math.min(Math.max(0, clientX - rect.left), rect.width) / rect.width;
      return ratio * el.duration;
    },
    [videoRef]
  );

  const onSeekPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      seekingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      seekTo(timeFromClientX(event.clientX));
      onChromeInteraction?.();
    },
    [seekTo, timeFromClientX, onChromeInteraction]
  );

  const onSeekPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!seekingRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      seekTo(timeFromClientX(event.clientX));
    },
    [seekTo, timeFromClientX]
  );

  const onSeekPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!seekingRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      seekingRef.current = false;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* released */
      }
      seekTo(timeFromClientX(event.clientX));
      onChromeInteraction?.();
    },
    [seekTo, timeFromClientX, onChromeInteraction]
  );

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onTimeUpdate = () => {
      if (seekingRef.current) return;
      setCurrentTime(el.currentTime);
    };
    const onDuration = () => {
      if (Number.isFinite(el.duration)) setDuration(el.duration);
    };
    const onLoaded = () => {
      onDuration();
      setCurrentTime(0);
    };

    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("durationchange", onDuration);
    el.addEventListener("loadedmetadata", onLoaded);

    if (Number.isFinite(el.duration)) setDuration(el.duration);

    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("durationchange", onDuration);
      el.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [videoRef]);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const coarseHide = heroCoarseChromeHideClass(coarseChromeHidden);

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-[6] flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-4 pointer-events-none ${HERO_IDLE_HIDE_FINE} ${coarseHide} ${className}`}
    >
      <span className="pointer-events-none w-10 shrink-0 text-center text-[10px] font-semibold tabular-nums text-white/90">
        {formatTime(currentTime)}
      </span>
      <div
        ref={barRef}
        role="slider"
        tabIndex={0}
        aria-label={txt.seek}
        aria-valuemin={0}
        aria-valuemax={Math.max(0, Math.round(duration))}
        aria-valuenow={Math.round(currentTime)}
        aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
        className="pointer-events-auto relative mx-0.5 flex h-8 min-w-0 flex-1 cursor-pointer touch-none items-center"
        onPointerDown={onSeekPointerDown}
        onPointerMove={onSeekPointerMove}
        onPointerUp={onSeekPointerUp}
        onPointerCancel={onSeekPointerUp}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 5;
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            seekTo(currentTime + step);
          } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            seekTo(currentTime - step);
          } else if (e.key === "Home") {
            e.preventDefault();
            seekTo(0);
          } else if (e.key === "End") {
            e.preventDefault();
            seekTo(duration);
          }
        }}
      >
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/35">
          <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <span className="pointer-events-none w-10 shrink-0 text-center text-[10px] font-semibold tabular-nums text-white/90">
        {formatTime(duration)}
      </span>
    </div>
  );
}

/** Hero/thumb caps: row layout sm+ (height-based thumb rail); portrait mobile max-sm keeps fixed-width thumbs. */
const HERO_FRAME =
  `relative shrink-0 overflow-hidden rounded-xl md:rounded-2xl bg-slate-900 aspect-[10/16] 2xl:aspect-[11/16] h-[min(56.7vh,25.1rem)] w-auto max-w-full sm:h-[min(56.7vh,29.3rem)] ${SHOWCASE_LANDSCAPE_SHORT}`;
const THUMB_FRAME =
  `relative shrink-0 overflow-hidden rounded-xl md:rounded-2xl bg-slate-900 aspect-[10/16] 2xl:aspect-[11/16] max-sm:w-28 sm:h-[min(49.9vh,25.8rem)] sm:w-auto ${SHOWCASE_THUMB_LANDSCAPE_SHORT}`;
function ShowcaseBrandPill({
  brandName,
  brandLogoUrl,
}: {
  brandName: string;
  brandLogoUrl: string | null;
}) {
  const logo = brandLogoUrl ? getCachedImageUrl(brandLogoUrl) ?? brandLogoUrl : null;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-sm sm:text-base">
      {logo ? (
        <Image
          src={logo}
          alt={`${brandName} logo`}
          width={36}
          height={36}
          className="h-8 w-8 shrink-0 rounded-full object-contain sm:h-9 sm:w-9"
        />
      ) : (
        <span className="h-8 w-8 shrink-0 rounded-full bg-slate-100 sm:h-9 sm:w-9" aria-hidden />
      )}
      {brandName}
    </span>
  );
}

export default function FeaturedCollaborationsShowcase({ data, lang }: Props) {
  const [activeId, setActiveId] = useState(data.initialHeroApplicationId);
  const [heroMuted, setHeroMuted] = useState(true);
  const [heroInView, setHeroInView] = useState(false);
  const [heroVideoSrc, setHeroVideoSrc] = useState<string | null>(null);
  const heroMutedRef = useRef(true);
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const heroFrameRef = useRef<HTMLDivElement>(null);
  const [isFinePointer, setIsFinePointer] = useState(true);
  const [touchChromeVisible, setTouchChromeVisible] = useState(true);
  const touchHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heroPointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const clusterScrollerRef = useRef<HTMLDivElement>(null);
  const thumbsScrollerRef = useRef<HTMLDivElement>(null);
  const [clusterOverflow, setClusterOverflow] = useState(false);
  const [clusterAtStart, setClusterAtStart] = useState(true);
  const [clusterAtEnd, setClusterAtEnd] = useState(false);
  const txt = COPY[lang];

  const coarseChromeHidden = !isFinePointer && !touchChromeVisible;

  const clearTouchHideTimer = useCallback(() => {
    if (touchHideTimerRef.current) {
      clearTimeout(touchHideTimerRef.current);
      touchHideTimerRef.current = null;
    }
  }, []);

  const scheduleTouchChromeHide = useCallback(() => {
    if (isFinePointer) return;
    clearTouchHideTimer();
    if (!heroVideoSrc) return;
    touchHideTimerRef.current = setTimeout(() => {
      setTouchChromeVisible(false);
    }, TOUCH_CHROME_HIDE_MS);
  }, [clearTouchHideTimer, heroVideoSrc, isFinePointer]);

  const showTouchChrome = useCallback(() => {
    if (isFinePointer) return;
    setTouchChromeVisible(true);
    scheduleTouchChromeHide();
  }, [isFinePointer, scheduleTouchChromeHide]);

  useEffect(() => {
    setIsFinePointer(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  useEffect(() => () => clearTouchHideTimer(), [clearTouchHideTimer]);

  useEffect(() => {
    if (isFinePointer) {
      clearTouchHideTimer();
      setTouchChromeVisible(true);
    }
  }, [isFinePointer, clearTouchHideTimer]);

  heroMutedRef.current = heroMuted;

  const cardById = useMemo(() => new Map(data.cards.map((c) => [c.applicationId, c])), [data.cards]);
  const active = cardById.get(activeId) ?? data.cards[0];
  const activeIsHostedPhoto = isHostedPhotoMedia(active.hostedMedia);
  const thumbnails = data.cards.filter((c) => c.applicationId !== active.applicationId);

  const stopCurrentHeroMedia = useCallback(() => {
    const el = heroVideoRef.current;
    if (el) releaseVideoMedia(el);
  }, []);

  const onPickThumb = useCallback(
    (applicationId: string) => {
      stopCurrentHeroMedia();
      setHeroVideoSrc(null);
      setActiveId(applicationId);
    },
    [stopCurrentHeroMedia]
  );

  const syncClusterScrollState = useCallback(() => {
    const lg = window.matchMedia(SHOWCASE_ROW_MQ).matches;
    const scrollEl = lg ? clusterScrollerRef.current : thumbsScrollerRef.current;
    if (!scrollEl) return;
    const track = lg
      ? (scrollEl.firstElementChild as HTMLElement | null)
      : scrollEl.querySelector<HTMLElement>("[data-showcase-thumb-row]");
    const contentWidth = lg && track ? track.scrollWidth : scrollEl.scrollWidth;
    const overflow = contentWidth > scrollEl.clientWidth + 1;
    setClusterOverflow(overflow);
    if (!overflow) {
      setClusterAtStart(true);
      setClusterAtEnd(true);
      return;
    }
    setClusterAtStart(scrollEl.scrollLeft <= 1);
    setClusterAtEnd(scrollEl.scrollLeft >= scrollEl.scrollWidth - scrollEl.clientWidth - 1);
  }, []);

  const scrollClusterBy = useCallback((dir: -1 | 1) => {
    const lg = window.matchMedia(SHOWCASE_ROW_MQ).matches;
    const el = lg ? clusterScrollerRef.current : thumbsScrollerRef.current;
    if (!el) return;
    const item = el.querySelector<HTMLElement>("[data-showcase-cluster-item]");
    const gap = (() => {
      const row = lg
        ? (el.firstElementChild as HTMLElement | null)
        : el.querySelector<HTMLElement>("[data-showcase-thumb-row]");
      if (!row) return 8;
      const g = getComputedStyle(row).columnGap;
      const n = parseFloat(g);
      return Number.isFinite(n) ? n : 8;
    })();
    const step = item ? item.offsetWidth + gap : el.clientWidth * 0.4;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }, []);

  useEffect(() => {
    syncClusterScrollState();
    const onScrollCluster = () => syncClusterScrollState();
    const clusterEl = clusterScrollerRef.current;
    const thumbsEl = thumbsScrollerRef.current;
    clusterEl?.addEventListener("scroll", onScrollCluster, { passive: true });
    thumbsEl?.addEventListener("scroll", onScrollCluster, { passive: true });
    const ro = new ResizeObserver(() => syncClusterScrollState());
    if (clusterEl) ro.observe(clusterEl);
    if (thumbsEl) ro.observe(thumbsEl);
    const clusterTrack = clusterEl?.firstElementChild;
    if (clusterTrack) ro.observe(clusterTrack);
    const thumbRow = thumbsEl?.querySelector("[data-showcase-thumb-row]");
    if (thumbRow) ro.observe(thumbRow);
    const onMq = () => syncClusterScrollState();
    const mq = window.matchMedia(SHOWCASE_ROW_MQ);
    mq.addEventListener("change", onMq);
    return () => {
      clusterEl?.removeEventListener("scroll", onScrollCluster);
      thumbsEl?.removeEventListener("scroll", onScrollCluster);
      ro.disconnect();
      mq.removeEventListener("change", onMq);
    };
  }, [thumbnails.length, activeId, syncClusterScrollState]);

  const advanceHero = useCallback(() => {
    stopCurrentHeroMedia();
    setHeroVideoSrc(null);
    const ids = data.cards.map((c) => c.applicationId);
    const idx = ids.indexOf(activeId);
    const nextId = ids[(idx + 1) % ids.length];
    setActiveId(nextId);
  }, [data.cards, activeId, stopCurrentHeroMedia]);

  useEffect(() => {
    const root = heroFrameRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setHeroInView(true);
      },
      { rootMargin: "120px" }
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!heroInView || !active.playUrl) {
      setHeroVideoSrc(null);
      return;
    }
    setHeroVideoSrc(active.playUrl);
  }, [heroInView, active.applicationId, active.playUrl]);

  const startHeroVideo = useCallback(() => {
    if (!active.playUrl) return;
    if (!heroInView) setHeroInView(true);
    setHeroVideoSrc(active.playUrl);
  }, [active.playUrl, heroInView]);

  useEffect(() => {
    const el = heroVideoRef.current;
    if (!el || !heroVideoSrc) return;
    if (el.getAttribute("src") !== heroVideoSrc) {
      el.src = heroVideoSrc;
    }
    if (active.posterUrl) el.poster = active.posterUrl;
    else el.removeAttribute("poster");
    el.muted = heroMutedRef.current;
    void el.play().catch(() => {
      setHeroMuted(true);
      el.muted = true;
      void el.play().catch(() => {
        /* still blocked */
      });
    });
  }, [heroVideoSrc, active.applicationId, active.posterUrl]);

  useEffect(() => {
    if (!heroVideoSrc || isFinePointer) return;
    setTouchChromeVisible(true);
    scheduleTouchChromeHide();
    const el = heroVideoRef.current;
    if (!el) return;
    const onPlay = () => scheduleTouchChromeHide();
    el.addEventListener("play", onPlay);
    return () => el.removeEventListener("play", onPlay);
  }, [heroVideoSrc, active.applicationId, isFinePointer, scheduleTouchChromeHide]);

  useEffect(() => {
    const el = heroVideoRef.current;
    if (!el) return;
    el.muted = heroMuted;
    if (!heroMuted) {
      void el.play().catch(() => {
        setHeroMuted(true);
      });
    }
  }, [heroMuted]);

  useEffect(() => {
    return () => {
      const el = heroVideoRef.current;
      if (el) releaseVideoMedia(el);
    };
  }, []);

  const toggleHeroMute = useCallback(() => {
    setHeroMuted((m) => !m);
    showTouchChrome();
  }, [showTouchChrome]);

  const onHeroPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isFinePointer) return;
      if ((event.target as HTMLElement).closest("button, [role=slider], a")) return;
      heroPointerStartRef.current = { x: event.clientX, y: event.clientY };
    },
    [isFinePointer]
  );

  const onHeroPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isFinePointer) return;
      if ((event.target as HTMLElement).closest("button, [role=slider], a")) return;
      const start = heroPointerStartRef.current;
      heroPointerStartRef.current = null;
      if (!start) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return;
      if (!touchChromeVisible) {
        event.preventDefault();
        event.stopPropagation();
        showTouchChrome();
        return;
      }
      showTouchChrome();
    },
    [isFinePointer, showTouchChrome, touchChromeVisible]
  );

  return (
    <div className="relative">
      <div className="relative overflow-visible rounded-2xl md:rounded-3xl">
        <div
          className="pointer-events-none absolute inset-0 z-0 rounded-2xl bg-[#F7F7F7] md:rounded-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-[-12vw] top-[-5rem] z-[5] hidden h-auto w-[40vw] max-w-[620px] select-none lg:block"
          aria-hidden
        >
          <Image
            src="/images/athos-food-falling.webp"
            alt="Decorative collage of Greek food ingredients"
            width={900}
            height={1200}
            className="h-auto w-full"
            sizes="(min-width: 1024px) 40vw, 0px"
          />
        </div>
        <div className="pointer-events-none absolute left-1/2 top-0 z-[6] -translate-x-1/2 -translate-y-1/2">
          <ShowcaseBrandPill brandName={data.brandName} brandLogoUrl={data.brandLogoUrl} />
        </div>
        <div className="relative z-10 p-4 pt-7 sm:p-5 sm:pt-8 md:p-6 lg:px-1 lg:pb-6">
        <div className="relative mx-auto flex w-full max-w-full min-w-0 items-end justify-center gap-1.5">
          {clusterOverflow ? (
            <button
              type="button"
              aria-label={txt.thumbsPrev}
              disabled={clusterAtStart}
              onClick={() => scrollClusterBy(-1)}
              className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white max-sm:hidden"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : null}
          <div
            ref={clusterScrollerRef}
            className={`min-w-0 overscroll-x-contain scroll-py-1 pt-1 max-sm:overflow-visible max-sm:snap-none max-sm:scroll-px-0 max-sm:px-0 ${THUMBS_SCROLLBAR_HIDE} ${
              clusterOverflow
                ? `w-full min-w-0 max-w-full flex-1 pb-2 sm:overflow-x-auto sm:snap-x sm:snap-mandatory sm:scroll-px-2 sm:px-2 sm:pb-1 sm:pt-1`
                : `w-max max-w-full max-sm:w-full pb-2 sm:overflow-visible sm:snap-none sm:scroll-px-0 sm:px-0 sm:pb-1 sm:pt-1`
            }`}
          >
            <div className="mx-auto flex w-full max-w-full min-w-0 flex-col items-center gap-4 sm:w-max sm:max-w-none sm:flex-row sm:items-end sm:justify-center sm:gap-2">
          <div
            className={`relative flex min-w-0 shrink-0 justify-center max-sm:w-full max-sm:max-w-full max-sm:touch-pan-y ${clusterOverflow ? "sm:snap-start" : ""}`}
            data-showcase-cluster-item
          >
            <div className="rounded-xl shadow-none transition duration-300 ease-out hover:-translate-y-1 hover:shadow-xl md:rounded-2xl">
            <div
              ref={heroFrameRef}
              className={`group/hero ${HERO_FRAME}`}
              onPointerDown={onHeroPointerDown}
              onPointerUp={onHeroPointerUp}
            >
              {active.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={active.posterUrl}
                  alt={`${active.influencerName} — ${data.brandName}`}
                  className={`absolute inset-0 h-full w-full object-cover ${heroVideoSrc ? "opacity-0" : ""}`}
                />
              ) : null}
              {activeIsHostedPhoto ? (
                <div className="absolute inset-0 h-full w-full overflow-hidden">
                  <HostedMediaPlayer media={active.hostedMedia} lang={lang} />
                </div>
              ) : (
                <video
                  ref={heroVideoRef}
                  className="absolute inset-0 h-full w-full object-cover"
                  muted={heroMuted}
                  playsInline
                  preload="none"
                  onEnded={advanceHero}
                  onClick={(e) => {
                    if (!isFinePointer && !touchChromeVisible) {
                      e.preventDefault();
                      return;
                    }
                    startHeroVideo();
                  }}
                />
              )}
              {active.publicViews != null ? (
                <p
                  className={`${VIEWS_BADGE_CLASS} ${HERO_IDLE_HIDE_FINE} ${heroCoarseChromeHideClass(coarseChromeHidden)}`}
                >
                  {formatPerVideoViews(active.publicViews, lang)}
                </p>
              ) : null}
              <button
                type="button"
                className={`absolute bottom-[3.25rem] right-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${HERO_IDLE_HIDE_FINE} ${heroCoarseChromeHideClass(coarseChromeHidden)}`}
                aria-label={heroMuted ? txt.unmute : txt.mute}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleHeroMute();
                }}
              >
                {heroMuted ? (
                  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
                    <path d="M5 9v6h4l5 5V4L9 9H5zm12.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                    <path d="M3.27 3 2 4.27 6.73 9H5v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 3.27 3z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
                    <path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                )}
              </button>
              <CreatorLinkOverlay
                name={active.influencerName}
                href={active.influencerProfileHref}
                avatarUrl={active.influencerAvatarUrl}
                platform={active.platform}
                className="bottom-[2.75rem] pb-2"
                isFinePointer={isFinePointer}
                coarseChromeHidden={coarseChromeHidden}
              />
              <HeroSeekBar
                key={active.applicationId}
                videoRef={heroVideoRef}
                lang={lang}
                coarseChromeHidden={coarseChromeHidden}
                onChromeInteraction={showTouchChrome}
              />
            </div>
            </div>
          </div>

          {thumbnails.length > 0 ? (
            <div className="flex w-full max-w-full min-w-0 flex-col items-center gap-2 sm:contents sm:gap-0">
              <div className="flex w-full min-w-0 items-end gap-1.5 max-sm:pb-0 sm:contents">
                {clusterOverflow ? (
                  <button
                    type="button"
                    aria-label={txt.thumbsPrev}
                    disabled={clusterAtStart}
                    onClick={() => scrollClusterBy(-1)}
                    className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white sm:hidden"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                ) : null}
                <div
                  ref={thumbsScrollerRef}
                  className={`min-w-0 w-full flex-1 overscroll-x-contain scroll-py-1 pb-2 pt-1 max-sm:overflow-x-auto max-sm:snap-x max-sm:snap-mandatory max-sm:scroll-px-2 max-sm:px-2 sm:contents sm:overflow-visible sm:p-0 sm:snap-none ${THUMBS_SCROLLBAR_HIDE}`}
                >
                  <div
                    data-showcase-thumb-row
                    className="mx-auto flex w-max max-w-none flex-row items-end justify-center gap-3 sm:contents sm:gap-2"
                  >
              {thumbnails.map((card) => (
                <div
                  key={card.applicationId}
                  data-showcase-cluster-item
                  data-showcase-thumb
                  className={`shrink-0 rounded-xl shadow-none transition duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg md:rounded-2xl max-sm:snap-start ${
                    clusterOverflow ? "sm:snap-start" : ""
                  }`}
                >
                <div className={THUMB_FRAME}>
                  <button
                    type="button"
                    className="absolute inset-0 h-full w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                    onClick={() => onPickThumb(card.applicationId)}
                    aria-label={`${txt.playVideo} — ${card.influencerName}`}
                  >
                    {card.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={card.posterUrl}
                        alt={`${card.influencerName} — ${data.brandName}`}
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="absolute inset-0 bg-slate-800" aria-hidden />
                    )}
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 via-black/45 to-transparent"
                      aria-hidden
                    />
                  </button>
                  {card.publicViews != null ? (
                    <p className={`pointer-events-none ${VIEWS_BADGE_CLASS}`}>
                      {formatPerVideoViews(card.publicViews, lang)}
                    </p>
                  ) : null}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] pb-3 px-3">
                    <CreatorProfileLink
                      name={card.influencerName}
                      href={card.influencerProfileHref}
                      avatarUrl={card.influencerAvatarUrl}
                      platform={card.platform}
                      className="pointer-events-auto max-w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    />
                  </div>
                </div>
                </div>
              ))}
                  </div>
                </div>
                {clusterOverflow ? (
                  <button
                    type="button"
                    aria-label={txt.thumbsNext}
                    disabled={clusterAtEnd}
                    onClick={() => scrollClusterBy(1)}
                    className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white sm:hidden"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
            </div>
          </div>
          {clusterOverflow ? (
            <button
              type="button"
              aria-label={txt.thumbsNext}
              disabled={clusterAtEnd}
              onClick={() => scrollClusterBy(1)}
              className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white max-sm:hidden"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : null}
        </div>

        {data.totalViews != null ? (
          <p className="mt-5 text-center text-base font-medium text-slate-600 sm:mt-6 sm:text-lg">
            <span className="group/views relative inline-block pb-1">
              {txt.publicViewsLead}{" "}
              <CountUp
                value={data.totalViews}
                formatLocale={lang === "el" ? "el-GR" : "en-GB"}
                className="font-semibold text-slate-800"
              />{" "}
              {txt.publicViews}
              <span
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[2.5px] rounded-full bg-gradient-to-r from-[var(--secondary)] to-[var(--accent)] bg-[length:200%_100%] bg-[position:0%_50%] motion-reduce:lg:transition-none lg:transition-[background-position] lg:duration-300 lg:ease-out [@media(hover:hover)_and_(min-width:1024px)]:group-hover/views:bg-[position:100%_50%] [@media(prefers-reduced-motion:reduce)_and_(min-width:1024px)]:group-hover/views:bg-[position:0%_50%]"
                aria-hidden
              />
            </span>
          </p>
        ) : null}

        <p className="sr-only">
          {data.brandName} {txt.with} Influo creators
        </p>
        </div>
      </div>
    </div>
  );
}