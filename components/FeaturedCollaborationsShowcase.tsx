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
  },
  en: {
    with: "with",
    unmute: "Sound",
    mute: "Mute",
    playVideo: "Play video",
    seek: "Video progress",
    publicViewsLead: "Already",
    publicViews: "views",
  },
} as const;

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

/** Fine-pointer desktops: fade chrome when pointer leaves hero; touch keeps controls visible. */
const HERO_IDLE_HIDE_FINE =
  "transition-opacity duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-[:not(:hover)]/hero:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-[:not(:hover)]/hero:pointer-events-none";

/** Fine-pointer idle: name only at bottom-left; coarse/touch keeps full chrome via hover overlay. */
const HERO_IDLE_NAME_FINE =
  "opacity-0 pointer-events-none transition-opacity duration-200 [@media(hover:hover)_and_(pointer:fine)]:group-[:not(:hover)]/hero:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-[:not(:hover)]/hero:pointer-events-auto";

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
}: {
  name: string;
  href: string;
  avatarUrl: string | null;
  platform?: FeaturedCollaborationPlatform | null;
  className?: string;
}) {
  return (
    <>
      <div
        className={`absolute inset-x-0 z-[5] px-3 pt-16 bg-gradient-to-t from-black/80 via-black/45 to-transparent pointer-events-none ${HERO_IDLE_HIDE_FINE} ${className}`}
        aria-hidden
      />
      <div
        className={`absolute inset-x-0 z-[5] px-3 pointer-events-none ${HERO_IDLE_HIDE_FINE} ${className}`}
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
        className={`absolute bottom-3 left-3 z-[5] max-w-[calc(100%-1.5rem)] truncate text-xs font-semibold text-white sm:text-sm [text-shadow:0_1px_3px_rgba(0,0,0,0.85),0_0_8px_rgba(0,0,0,0.45)] hover:underline underline-offset-2 ${HERO_IDLE_NAME_FINE}`}
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
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  lang: Lang;
  className?: string;
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
    },
    [seekTo, timeFromClientX]
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
    },
    [seekTo, timeFromClientX]
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

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-[6] flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-4 pointer-events-none ${HERO_IDLE_HIDE_FINE} ${className}`}
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

/** Hero/thumb caps: ~10% shorter again vs prior MAG-1; lg:gap-4; thumbs ~88% of hero height; 2xl widens ratio. */
const HERO_FRAME =
  "relative shrink-0 overflow-hidden rounded-xl md:rounded-2xl bg-slate-900 aspect-[10/16] 2xl:aspect-[11/16] h-[min(56.7vh,25.1rem)] w-auto max-w-full lg:h-[min(56.7vh,29.3rem)]";
const THUMB_FRAME =
  "relative shrink-0 overflow-hidden rounded-xl md:rounded-2xl bg-slate-900 aspect-[10/16] 2xl:aspect-[11/16] w-28 sm:w-32 md:w-36 lg:h-[min(49.9vh,25.8rem)] lg:w-auto";
const THUMBS_COLUMN_HEIGHT = "lg:h-[min(56.7vh,29.3rem)]";

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
  const txt = COPY[lang];

  heroMutedRef.current = heroMuted;

  const cardById = useMemo(() => new Map(data.cards.map((c) => [c.applicationId, c])), [data.cards]);
  const active = cardById.get(activeId) ?? data.cards[0];
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
  }, []);

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
        <div className="relative z-10 p-4 pt-7 sm:p-5 sm:pt-8 md:p-6">
        <div className="relative mx-auto flex w-full flex-col items-center gap-4 lg:flex-row lg:items-end lg:justify-center lg:gap-4">
          <div className="relative flex justify-center">
            <div className="rounded-xl shadow-none transition duration-300 ease-out hover:-translate-y-1 hover:shadow-xl md:rounded-2xl">
            <div ref={heroFrameRef} className={`group/hero ${HERO_FRAME}`}>
              {active.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={active.posterUrl}
                  alt={`${active.influencerName} — ${data.brandName}`}
                  className={`absolute inset-0 h-full w-full object-cover ${heroVideoSrc ? "opacity-0" : ""}`}
                />
              ) : null}
              <video
                ref={heroVideoRef}
                className="absolute inset-0 h-full w-full object-cover"
                muted={heroMuted}
                playsInline
                preload="none"
                onEnded={advanceHero}
                onClick={startHeroVideo}
              />
              <button
                type="button"
                className={`absolute bottom-[3.25rem] right-3 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/65 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${HERO_IDLE_HIDE_FINE}`}
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
              />
              <HeroSeekBar key={active.applicationId} videoRef={heroVideoRef} lang={lang} />
            </div>
            </div>
          </div>

          {thumbnails.length > 0 ? (
            <div
              className={`flex w-full max-w-full flex-col items-center gap-3 lg:w-auto lg:max-w-none lg:shrink-0 lg:justify-end lg:gap-0 ${THUMBS_COLUMN_HEIGHT}`}
            >
              <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain scroll-px-3 px-3 pb-2 pt-1 lg:overflow-visible lg:px-0 lg:pb-0 lg:pt-0">
                <div className="mx-auto flex w-max max-w-none flex-row items-end justify-center gap-3 lg:mx-0 lg:w-auto lg:gap-4">
              {thumbnails.map((card) => (
                <div
                  key={card.applicationId}
                  className="rounded-xl shadow-none transition duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg md:rounded-2xl"
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
            </div>
          ) : null}
        </div>

        {data.totalViews != null ? (
          <p className="mt-5 text-center text-base font-medium text-slate-600 sm:mt-6 sm:text-lg">
            <span className="relative inline-block pb-1">
              {txt.publicViewsLead}{" "}
              <CountUp
                value={data.totalViews}
                formatLocale={lang === "el" ? "el-GR" : "en-GB"}
                className="font-semibold text-slate-800"
              />{" "}
              {txt.publicViews}
              <span
                className="pointer-events-none absolute inset-x-0 bottom-0 h-[2.5px] rounded-full bg-gradient-to-r from-[var(--secondary)] to-[var(--accent)]"
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