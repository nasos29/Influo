"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import TikTokSoundPromptButton from "@/components/TikTokSoundPromptButton";
import { TIKTOK_SOUND_COPY } from "@/lib/useTikTokPlayerHost";
import { usePortfolioMediaControls } from "@/lib/usePortfolioMediaControls";
import type { HostedMedia } from "@/lib/creatorMedia";

const COPY = {
  play: { el: "Αναπαραγωγή", en: "Play" },
  pause: { el: "Παύση", en: "Pause" },
  resume: { el: "Συνέχεια", en: "Resume" },
  seek: { el: "Πρόοδος αναπαραγωγής", en: "Playback progress" },
  mute: { el: "Σίγαση", en: "Mute" },
  unmute: { el: "Ήχος", en: "Unmute" },
} as const;

const HIDE_MS = 2000;

function canPlayCodec(codec: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    return document.createElement("video").canPlayType(`video/mp4; codecs="${codec}"`) !== "";
  } catch {
    return false;
  }
}

/** Prefer the smallest compatible rendition: AV1 → HEVC → H.264. */
export function pickHostedPlaybackUrl(media: HostedMedia): string {
  if (media.av1Url && canPlayCodec("av01.0.05M.08,mp4a.40.2")) return media.av1Url;
  if (
    media.hevcUrl &&
    (canPlayCodec("hvc1.1.6.L93.B0") || canPlayCodec("hev1.1.6.L93.B0"))
  ) {
    return media.hevcUrl;
  }
  return media.playUrl;
}

function sourceKind(media: HostedMedia, url: string): "av1" | "hevc" | "h264" {
  if (url === media.av1Url) return "av1";
  if (url === media.hevcUrl) return "hevc";
  return "h264";
}

function fallbackUrls(media: HostedMedia, current: string): string[] {
  const ordered = [media.av1Url, media.hevcUrl, media.playUrl].filter(
    (u, i, arr): u is string => Boolean(u) && arr.indexOf(u) === i
  );
  const idx = ordered.indexOf(current);
  return idx >= 0 ? ordered.slice(idx + 1) : ordered;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * In-card player for Influo-hosted videos. Play/pause, seek, and sound —
 * no browser chrome, no off-site links, no DRM. Fills the card and pauses peers.
 */
export default function HostedVideoPlayer({
  media,
  lang = "el",
  posterFallback,
  onError,
}: {
  media: HostedMedia;
  lang?: "el" | "en";
  posterFallback?: string | null;
  onError?: () => void;
}) {
  const uiLang = lang === "en" ? "en" : "el";
  const [muted, setMuted] = useState(false);
  const [showSound, setShowSound] = useState(false);
  const startedRef = useRef(false);
  const [playUrl, setPlayUrl] = useState(() => pickHostedPlaybackUrl(media));
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveringRef = useRef(false);
  const seekingRef = useRef(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const {
    videoRef: mediaVideoRef,
    playing,
    toggle,
    pauseSelf,
  } = usePortfolioMediaControls("native", true);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    if (!playing || hoveringRef.current || seekingRef.current || showSound) return;
    hideTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, HIDE_MS);
  }, [clearHideTimer, playing, showSound]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    setPlayUrl(pickHostedPlaybackUrl(media));
    startedRef.current = false;
    setCurrentTime(0);
  }, [media]);

  useEffect(() => {
    if (playing) scheduleHide();
    else {
      clearHideTimer();
      setControlsVisible(true);
    }
    return clearHideTimer;
  }, [playing, scheduleHide, clearHideTimer]);

  const tryUnmutedPlay = useCallback((el: HTMLVideoElement) => {
    el.muted = false;
    const attempt = el.play();
    if (!attempt) return;
    attempt.catch(() => {
      el.muted = true;
      setMuted(true);
      setShowSound(true);
      void el.play()?.catch(() => {
        /* autoplay blocked even muted */
      });
    });
  }, []);

  const onTapForSound = useCallback(() => {
    const el = mediaVideoRef.current;
    if (!el) return;
    el.muted = false;
    setMuted(false);
    setShowSound(false);
    void el.play()?.catch(() => {
      el.muted = true;
      setMuted(true);
      setShowSound(true);
    });
    showControls();
  }, [mediaVideoRef, showControls]);

  const toggleMute = useCallback(() => {
    const el = mediaVideoRef.current;
    if (!el) return;
    if (el.muted || showSound) {
      onTapForSound();
      return;
    }
    el.muted = true;
    setMuted(true);
    showControls();
  }, [mediaVideoRef, onTapForSound, showSound, showControls]);

  const seekTo = useCallback(
    (time: number) => {
      const el = mediaVideoRef.current;
      if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
      const next = Math.min(Math.max(0, time), el.duration);
      el.currentTime = next;
      setCurrentTime(next);
    },
    [mediaVideoRef]
  );

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const el = mediaVideoRef.current;
      const bar = barRef.current;
      if (!el || !bar || !Number.isFinite(el.duration) || el.duration <= 0) return 0;
      const rect = bar.getBoundingClientRect();
      const ratio = rect.width <= 0 ? 0 : Math.min(Math.max(0, clientX - rect.left), rect.width) / rect.width;
      return ratio * el.duration;
    },
    [mediaVideoRef]
  );

  const onSeekPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      seekingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      const t = timeFromClientX(event.clientX);
      seekTo(t);
      showControls();
    },
    [seekTo, showControls, timeFromClientX]
  );

  const onSeekPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!seekingRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      const t = timeFromClientX(event.clientX);
      seekTo(t);
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
        /* already released */
      }
      seekTo(timeFromClientX(event.clientX));
      showControls();
    },
    [seekTo, showControls, timeFromClientX]
  );

  useEffect(() => {
    const el = mediaVideoRef.current;
    if (!el || startedRef.current) return;
    startedRef.current = true;
    tryUnmutedPlay(el);
  }, [mediaVideoRef, tryUnmutedPlay, playUrl]);

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <>
      <video
        src={playUrl}
        poster={media.posterUrl || posterFallback || undefined}
        playsInline
        autoPlay
        preload="metadata"
        controls={false}
        muted={muted}
        className="absolute inset-0 z-[5] h-full w-full bg-black object-cover"
        ref={(el) => {
          mediaVideoRef.current = el;
        }}
        data-hosted-player="true"
        data-source-kind={sourceKind(media, playUrl)}
        onTimeUpdate={(e) => {
          if (seekingRef.current) return;
          setCurrentTime(e.currentTarget.currentTime);
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDuration(d);
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDuration(d);
        }}
        onError={() => {
          const next = fallbackUrls(media, playUrl)[0];
          if (next) {
            startedRef.current = false;
            setPlayUrl(next);
            return;
          }
          onError?.();
        }}
        onPlay={() => {
          if (!mediaVideoRef.current?.muted) {
            setMuted(false);
            setShowSound(false);
          }
        }}
        onEnded={() => {
          pauseSelf();
          setControlsVisible(true);
        }}
      />
      <div
        className="absolute inset-0 z-[15]"
        onMouseEnter={() => {
          hoveringRef.current = true;
          showControls();
        }}
        onMouseLeave={() => {
          hoveringRef.current = false;
          scheduleHide();
        }}
        onMouseMove={showControls}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("[data-hosted-controls]")) return;
          pointerStartRef.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          if ((e.target as HTMLElement).closest("[data-hosted-controls]")) return;
          const start = pointerStartRef.current;
          pointerStartRef.current = null;
          if (!start) return;
          const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
          if (moved > 10) return;
          if (!controlsVisible) {
            showControls();
            return;
          }
          if (showSound) {
            onTapForSound();
            return;
          }
          toggle();
          showControls();
        }}
      >
        <div
          data-hosted-controls="true"
          data-visible={controlsVisible ? "true" : "false"}
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 pb-1.5 pt-8 transition-opacity duration-200 ${
            controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="flex items-center gap-1 text-white">
            <button
              type="button"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              aria-label={playing ? COPY.pause[uiLang] : currentTime > 0 ? COPY.resume[uiLang] : COPY.play[uiLang]}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (showSound) {
                  onTapForSound();
                  return;
                }
                toggle();
                showControls();
              }}
            >
              {playing ? (
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
                  <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6 fill-current" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <span className="w-9 shrink-0 text-center text-[11px] font-semibold tabular-nums text-white/90">
              {formatTime(currentTime)}
            </span>
            <div
              ref={barRef}
              data-hosted-seek="true"
              role="slider"
              tabIndex={0}
              aria-label={COPY.seek[uiLang]}
              aria-valuemin={0}
              aria-valuemax={Math.max(0, Math.round(duration))}
              aria-valuenow={Math.round(currentTime)}
              aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
              className="relative mx-1 flex h-11 min-w-0 flex-1 cursor-pointer touch-none items-center"
              onPointerDown={onSeekPointerDown}
              onPointerMove={onSeekPointerMove}
              onPointerUp={onSeekPointerUp}
              onPointerCancel={onSeekPointerUp}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 10 : 5;
                if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                  e.preventDefault();
                  seekTo(currentTime + step);
                  showControls();
                } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                  e.preventDefault();
                  seekTo(currentTime - step);
                  showControls();
                } else if (e.key === "Home") {
                  e.preventDefault();
                  seekTo(0);
                  showControls();
                } else if (e.key === "End") {
                  e.preventDefault();
                  seekTo(duration);
                  showControls();
                }
              }}
            >
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
                style={{ left: `${progress}%` }}
              />
            </div>
            <span className="w-9 shrink-0 text-center text-[11px] font-semibold tabular-nums text-white/90">
              {formatTime(duration)}
            </span>
            <button
              type="button"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              aria-label={muted || showSound ? COPY.unmute[uiLang] : COPY.mute[uiLang]}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleMute();
              }}
            >
              {muted || showSound ? (
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
          </div>
        </div>
      </div>
      {showSound ? (
        <TikTokSoundPromptButton label={TIKTOK_SOUND_COPY[uiLang]} onClick={onTapForSound} />
      ) : null}
    </>
  );
}
