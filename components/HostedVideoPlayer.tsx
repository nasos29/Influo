"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent as ReactTransitionEvent,
} from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2 } from "lucide-react";
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
  volume: { el: "Ένταση ήχου", en: "Volume" },
  expand: { el: "Μεγέθυνση", en: "Enlarge" },
  shrink: { el: "Σμίκρυνση", en: "Shrink" },
} as const;

const SEEK_FILL = "#FE2C55";
const VOLUME_STORAGE_KEY = "hosted-video-player-audio";

type StoredAudio = { volume: number; muted: boolean; lastVolume: number };

function readStoredAudio(): StoredAudio | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(VOLUME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAudio>;
    const lastVolume =
      typeof parsed.lastVolume === "number" && parsed.lastVolume > 0
        ? Math.min(1, parsed.lastVolume)
        : 1;
    const volume =
      typeof parsed.volume === "number" ? Math.min(1, Math.max(0, parsed.volume)) : lastVolume;
    const muted = Boolean(parsed.muted) || volume === 0;
    return { volume, muted, lastVolume };
  } catch {
    return null;
  }
}

function writeStoredAudio(data: StoredAudio): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(VOLUME_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

/** True when `HTMLVideoElement.volume` can be changed (not iOS read-only). */
function probeVolumeControl(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const el = document.createElement("video");
    const prev = el.volume;
    el.volume = 0.37;
    const ok = Math.abs(el.volume - 0.37) < 0.02;
    el.volume = prev;
    return ok;
  } catch {
    return false;
  }
}

const HIDE_MS = 2500;
const VOLUME_POPUP_CLOSE_MS = 300;
const ANIM_MS = 220;
const ANIM_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

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

/** Finite duration in seconds, or null for NaN / Infinity / <= 0. */
function positiveDuration(seconds: number): number | null {
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function durationFromMedia(durationMs: number | null | undefined): number {
  return durationMs && durationMs > 0 ? durationMs / 1000 : 0;
}

type Box = { width: number; height: number; left: number; top: number };

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** At least 2× the in-card size, same aspect ratio, capped to the viewport. */
function enlargedBox(srcW: number, srcH: number): Box {
  const aspect = srcW / Math.max(1, srcH);
  const pad = 16;
  const viewW = typeof window !== "undefined" ? window.innerWidth : srcW;
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const viewH = vv?.height ?? (typeof window !== "undefined" ? window.innerHeight : srcH);
  const offsetTop = vv?.offsetTop ?? 0;
  const offsetLeft = vv?.offsetLeft ?? 0;
  const maxW = Math.max(0, viewW - pad * 2);
  const maxH = Math.max(0, viewH - pad * 2);
  let width = srcW * 2;
  let height = srcH * 2;
  if (width > maxW) {
    width = maxW;
    height = width / aspect;
  }
  if (height > maxH) {
    height = maxH;
    width = height * aspect;
  }
  return {
    width,
    height,
    left: offsetLeft + (viewW - width) / 2,
    top: offsetTop + (viewH - height) / 2,
  };
}

function invertTransform(from: Box, to: Box): string {
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const sx = from.width / Math.max(1, to.width);
  const sy = from.height / Math.max(1, to.height);
  return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
}

function readBox(el: HTMLElement | null): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return { width: r.width, height: r.height, left: r.left, top: r.top };
}

/**
 * In-card player for Influo-hosted videos. Play/pause, seek, sound, and a
 * centered lightbox enlarge — no browser chrome, no off-site links, no DRM.
 */
export default function HostedVideoPlayer({
  media,
  lang = "el",
  posterFallback,
  onError,
  autoplayOnMount = true,
}: {
  media: HostedMedia;
  lang?: "el" | "en";
  posterFallback?: string | null;
  onError?: () => void;
  autoplayOnMount?: boolean;
}) {
  const uiLang = lang === "en" ? "en" : "el";
  const storedAudioRef = useRef<StoredAudio | null>(null);
  if (storedAudioRef.current === null && typeof window !== "undefined") {
    storedAudioRef.current = readStoredAudio();
  }
  const initialAudio = storedAudioRef.current;
  const [muted, setMuted] = useState(() => initialAudio?.muted ?? false);
  const [volume, setVolume] = useState(() =>
    initialAudio ? (initialAudio.muted ? 0 : initialAudio.volume) : 1
  );
  const lastNonZeroVolumeRef = useRef(initialAudio?.lastVolume ?? 1);
  const [volumeSliderSupported, setVolumeSliderSupported] = useState(false);
  const [showSound, setShowSound] = useState(false);
  const startedRef = useRef(false);
  const [playUrl, setPlayUrl] = useState(() => pickHostedPlaybackUrl(media));
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(() => durationFromMedia(media.durationMs));
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveringRef = useRef(false);
  const finePointerHoverRef = useRef(true);
  const seekingRef = useRef(false);
  const volumeDraggingRef = useRef(false);
  const volumePopupCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [volumePopupOpen, setVolumePopupOpen] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const slotRef = useRef<HTMLDivElement | null>(null);
  const ignoreTapUntilRef = useRef(0);
  const closingRef = useRef(false);
  const playbackBridgeRef = useRef<{
    time: number;
    playing: boolean;
    muted: boolean;
    volume: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [slotBox, setSlotBox] = useState<Box | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [expandedBox, setExpandedBox] = useState<Box | null>(null);
  const [closing, setClosing] = useState(false);
  const [flip, setFlip] = useState("");
  const [flipReady, setFlipReady] = useState(false);

  const {
    videoRef: mediaVideoRef,
    playing,
    toggle,
    pauseSelf,
  } = usePortfolioMediaControls("native", true, { claimOnMount: autoplayOnMount });

  const snapshotPlayback = useCallback(() => {
    const el = mediaVideoRef.current;
    if (!el) return;
    playbackBridgeRef.current = {
      time: Number.isFinite(el.currentTime) ? el.currentTime : 0,
      playing: !el.paused && !el.ended,
      muted: el.muted,
      volume: Number.isFinite(el.volume) ? el.volume : volume,
    };
  }, [mediaVideoRef, volume]);

  const applyPlaybackBridge = useCallback(
    (el: HTMLVideoElement) => {
      const snap = playbackBridgeRef.current;
      if (!snap) return;
      try {
        if (Number.isFinite(snap.time)) el.currentTime = snap.time;
      } catch {
        /* seek not ready */
      }
      if (volumeSliderSupported) {
        const level = snap.muted ? 0 : snap.volume;
        el.volume = level > 0 ? level : lastNonZeroVolumeRef.current || 1;
      }
      el.muted = snap.muted;
      setMuted(snap.muted);
      setVolume(snap.muted ? 0 : snap.volume);
      setCurrentTime(snap.time);
      if (snap.playing) void el.play().catch(() => {});
      else el.pause();
    },
    [volumeSliderSupported]
  );

  const lightbox = expanded || closing;
  const box = lightbox && expandedBox ? expandedBox : slotBox;

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const clearVolumePopupCloseTimer = useCallback(() => {
    if (volumePopupCloseTimerRef.current) {
      clearTimeout(volumePopupCloseTimerRef.current);
      volumePopupCloseTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    if (
      !playing ||
      hoveringRef.current ||
      seekingRef.current ||
      volumeDraggingRef.current ||
      volumePopupOpen ||
      showSound
    )
      return;
    hideTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, HIDE_MS);
  }, [clearHideTimer, playing, showSound, volumePopupOpen]);

  const scheduleVolumePopupClose = useCallback(() => {
    clearVolumePopupCloseTimer();
    volumePopupCloseTimerRef.current = setTimeout(() => {
      volumePopupCloseTimerRef.current = null;
      if (volumeDraggingRef.current) return;
      setVolumePopupOpen(false);
      scheduleHide();
    }, VOLUME_POPUP_CLOSE_MS);
  }, [clearVolumePopupCloseTimer, scheduleHide]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const finishClose = useCallback(() => {
    closingRef.current = false;
    setClosing(false);
    setExpanded(false);
    setExpandedBox(null);
    setFlip("");
    setFlipReady(false);
    showControls();
  }, [showControls]);

  const collapse = useCallback(() => {
    if (closingRef.current || !expanded) return;
    snapshotPlayback();
    const from = readBox(slotRef.current) || slotBox;
    const to = expandedBox;
    if (!from || !to || prefersReducedMotion()) {
      finishClose();
      return;
    }
    closingRef.current = true;
    setClosing(true);
    setFlipReady(true);
    setFlip(invertTransform(from, to));
    showControls();
  }, [expanded, expandedBox, slotBox, finishClose, showControls, snapshotPlayback]);

  const expandOrToggle = useCallback(() => {
    if (expanded || closingRef.current) {
      collapse();
      return;
    }
    snapshotPlayback();
    const from = readBox(slotRef.current) || slotBox;
    if (!from) return;
    const to = enlargedBox(from.width, from.height);
    setExpandedBox(to);
    setExpanded(true);
    setClosing(false);
    showControls();
    if (prefersReducedMotion()) {
      setFlip("");
      setFlipReady(true);
      return;
    }
    setFlipReady(false);
    setFlip(invertTransform(from, to));
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setFlipReady(true);
        setFlip("");
      });
    });
  }, [expanded, slotBox, collapse, showControls, snapshotPlayback]);

  useLayoutEffect(() => {
    setMounted(true);
    setVolumeSliderSupported(probeVolumeControl());
    finePointerHoverRef.current = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const next = readBox(slotRef.current);
    if (next) setSlotBox(next);
  }, []);

  const persistAudio = useCallback((nextVolume: number, nextMuted: boolean) => {
    writeStoredAudio({
      volume: nextVolume,
      muted: nextMuted,
      lastVolume: lastNonZeroVolumeRef.current,
    });
  }, []);

  const applyVolumeToElement = useCallback(
    (el: HTMLVideoElement, level: number, forceMute: boolean) => {
      const v = Math.min(1, Math.max(0, level));
      if (v > 0) lastNonZeroVolumeRef.current = v;
      el.volume = v > 0 ? v : lastNonZeroVolumeRef.current;
      const isMute = forceMute || v === 0;
      el.muted = isMute;
      setVolume(isMute ? 0 : v);
      setMuted(isMute);
      if (!isMute) setShowSound(false);
      persistAudio(isMute ? 0 : v, isMute);
    },
    [persistAudio]
  );

  const setVolumeLevel = useCallback(
    (level: number) => {
      const el = mediaVideoRef.current;
      if (!el) return;
      applyVolumeToElement(el, level, level === 0);
      showControls();
    },
    [applyVolumeToElement, mediaVideoRef, showControls]
  );

  useLayoutEffect(() => {
    if (!mounted) return;
    const update = () => {
      const next = readBox(slotRef.current);
      if (next) setSlotBox(next);
    };
    update();
    const slot = slotRef.current;
    const ro = new ResizeObserver(update);
    if (slot) ro.observe(slot);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [mounted]);

  useEffect(() => {
    ignoreTapUntilRef.current = Date.now() + 450;
  }, [playUrl]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        collapse();
      }
    };
    const onResize = () => {
      const src = readBox(slotRef.current) || slotBox;
      if (!src || closingRef.current) return;
      setExpandedBox(enlargedBox(src.width, src.height));
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, [lightbox, collapse, slotBox]);

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(finishClose, ANIM_MS + 80);
    return () => window.clearTimeout(timer);
  }, [closing, finishClose]);

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

  useEffect(() => {
    if (!volumePopupOpen) return;
    const onDocPointerDown = (event: PointerEvent) => {
      if ((event.target as Element).closest("[data-hosted-volume]")) return;
      if (volumeDraggingRef.current) return;
      clearVolumePopupCloseTimer();
      setVolumePopupOpen(false);
      scheduleHide();
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, [volumePopupOpen, scheduleHide, clearVolumePopupCloseTimer]);

  useEffect(() => () => clearVolumePopupCloseTimer(), [clearVolumePopupCloseTimer]);

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
    const restore = lastNonZeroVolumeRef.current > 0 ? lastNonZeroVolumeRef.current : 1;
    el.volume = restore;
    el.muted = false;
    setVolume(restore);
    setMuted(false);
    setShowSound(false);
    persistAudio(restore, false);
    void el.play()?.catch(() => {
      el.muted = true;
      setMuted(true);
      setShowSound(true);
      persistAudio(0, true);
    });
    showControls();
  }, [mediaVideoRef, persistAudio, showControls]);

  const toggleMute = useCallback(() => {
    const el = mediaVideoRef.current;
    if (!el) return;
    if (el.muted || showSound || volume === 0) {
      onTapForSound();
      return;
    }
    if (el.volume > 0) lastNonZeroVolumeRef.current = el.volume;
    el.muted = true;
    setMuted(true);
    setVolume(0);
    persistAudio(0, true);
    showControls();
  }, [mediaVideoRef, onTapForSound, persistAudio, showSound, showControls, volume]);

  const knownDuration = useCallback(
    (el: HTMLVideoElement | null) => positiveDuration(el?.duration ?? NaN) ?? positiveDuration(duration),
    [duration]
  );

  const seekTo = useCallback(
    (time: number) => {
      const el = mediaVideoRef.current;
      const known = knownDuration(el);
      if (!el || known == null) return;
      const next = Math.min(Math.max(0, time), known);
      try {
        el.currentTime = next;
      } catch {
        /* not seekable yet */
      }
      setCurrentTime(next);
    },
    [knownDuration, mediaVideoRef]
  );

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const el = mediaVideoRef.current;
      const bar = barRef.current;
      const known = knownDuration(el);
      if (!bar || known == null) return 0;
      const rect = bar.getBoundingClientRect();
      const ratio = rect.width <= 0 ? 0 : Math.min(Math.max(0, clientX - rect.left), rect.width) / rect.width;
      return ratio * known;
    },
    [knownDuration, mediaVideoRef]
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

  const syncDurationFromElement = useCallback((el: HTMLVideoElement | null) => {
    if (!el || el.readyState < 1) return;
    const d = positiveDuration(el.duration);
    if (d != null) setDuration(d);
  }, []);

  useLayoutEffect(() => {
    syncDurationFromElement(mediaVideoRef.current);
  }, [mediaVideoRef, playUrl, syncDurationFromElement]);

  useEffect(() => {
    if (!autoplayOnMount) return;
    const el = mediaVideoRef.current;
    if (!el || startedRef.current) return;
    startedRef.current = true;
    const stored = storedAudioRef.current;
    if (stored && volumeSliderSupported) {
      const level = stored.muted ? stored.lastVolume : stored.volume;
      if (level > 0) {
        el.volume = level;
        lastNonZeroVolumeRef.current = level;
      }
    }
    tryUnmutedPlay(el);
  }, [autoplayOnMount, mediaVideoRef, tryUnmutedPlay, playUrl, volumeSliderSupported]);

  useEffect(() => {
    const el = mediaVideoRef.current;
    if (!el || !volumeSliderSupported) return;
    if (volume > 0) el.volume = volume;
    else if (lastNonZeroVolumeRef.current > 0) el.volume = lastNonZeroVolumeRef.current;
  }, [mediaVideoRef, volume, volumeSliderSupported, playUrl]);

  const onShellTransitionEnd = useCallback(
    (event: ReactTransitionEvent<HTMLDivElement>) => {
      if (event.propertyName !== "transform") return;
      if (closingRef.current) finishClose();
    },
    [finishClose]
  );

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const reduceMotion = mounted && prefersReducedMotion();
  const backdropOpen = expanded && !closing && (flipReady || reduceMotion);

  useLayoutEffect(() => {
    const el = mediaVideoRef.current;
    if (!el) return;
    applyPlaybackBridge(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync playback only when moving between in-card and portaled shell
  }, [lightbox, applyPlaybackBridge]);

  const renderPlayerShell = (portaled: boolean) => {
    if (portaled && !box) return null;
    return (
    <div
      ref={shellRef}
      data-hosted-shell="true"
      data-hosted-expanded={expanded && !closing ? "true" : "false"}
      className="overflow-hidden bg-black"
      style={
        portaled
          ? {
              position: "fixed",
              width: box!.width,
              height: box!.height,
              left: box!.left,
              top: box!.top,
              zIndex: 210,
              borderRadius: 12,
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.45)",
              transform: flip || "none",
              transformOrigin: "top left",
              transition:
                !flipReady || reduceMotion
                  ? "none"
                  : `transform ${ANIM_MS}ms ${ANIM_EASE}, box-shadow ${ANIM_MS}ms ${ANIM_EASE}`,
              willChange: flipReady && !reduceMotion ? "transform" : undefined,
            }
          : {
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              zIndex: 20,
              borderRadius: 12,
              boxShadow: "none",
              transform: "none",
              transformOrigin: "top left",
              transition: "none",
            }
      }
      onTransitionEnd={portaled ? onShellTransitionEnd : undefined}
      onMouseEnter={() => {
        if (!finePointerHoverRef.current) return;
        hoveringRef.current = true;
        showControls();
      }}
      onMouseLeave={() => {
        if (!finePointerHoverRef.current) return;
        hoveringRef.current = false;
        scheduleHide();
      }}
      onMouseMove={() => {
        if (!finePointerHoverRef.current) return;
        showControls();
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("[data-hosted-controls], [data-hosted-close]")) return;
        pointerStartRef.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        if ((e.target as HTMLElement).closest("[data-hosted-controls], [data-hosted-close]")) return;
        if (Date.now() < ignoreTapUntilRef.current) {
          pointerStartRef.current = null;
          return;
        }
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
      <video
        src={playUrl}
        poster={media.posterUrl || posterFallback || undefined}
        playsInline
        autoPlay={autoplayOnMount}
        preload="metadata"
        controls={false}
        muted={muted}
        className="absolute inset-0 z-[5] h-full w-full bg-black object-cover"
        ref={(el) => {
          mediaVideoRef.current = el;
          syncDurationFromElement(el);
        }}
        data-hosted-player="true"
        data-source-kind={sourceKind(media, playUrl)}
        onTimeUpdate={(e) => {
          if (seekingRef.current) return;
          setCurrentTime(e.currentTarget.currentTime);
        }}
        onDurationChange={(e) => {
          const d = positiveDuration(e.currentTarget.duration);
          if (d != null) setDuration(d);
        }}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          const d = positiveDuration(el.duration);
          if (d != null) setDuration(d);
          if (playbackBridgeRef.current) applyPlaybackBridge(el);
          else if (Number.isFinite(currentTime)) {
            try {
              el.currentTime = currentTime;
            } catch {
              /* not seekable yet */
            }
          }
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
      {portaled ? (
        <button
          type="button"
          data-hosted-close="true"
          className="absolute right-2 top-2 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white shadow-md hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          aria-label={COPY.shrink[uiLang]}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            collapse();
          }}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
            <path d="M18.3 5.71 12 12.01 5.7 5.7 4.29 7.11 10.59 13.4 4.29 19.7 5.7 21.11 12 14.82 18.29 21.11 19.7 19.7 13.41 13.4 19.71 7.11z" />
          </svg>
        </button>
      ) : null}
      <div className="pointer-events-none absolute inset-0 z-[15]">
        <div
          data-hosted-controls="true"
          data-visible={controlsVisible ? "true" : "false"}
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 pb-1.5 pt-8 transition-opacity duration-200 ${
            controlsVisible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
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
                  className="h-full rounded-full"
                  style={{ width: `${progress}%`, backgroundColor: SEEK_FILL }}
                />
              </div>
              <div
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow"
                style={{ left: `${progress}%`, backgroundColor: SEEK_FILL }}
              />
            </div>
            <span className="w-9 shrink-0 text-center text-[11px] font-semibold tabular-nums text-white/90">
              {formatTime(duration)}
            </span>
            <div
              data-hosted-volume="true"
              className="relative shrink-0"
              onMouseEnter={() => {
                if (!volumeSliderSupported) return;
                clearVolumePopupCloseTimer();
                setVolumePopupOpen(true);
                showControls();
              }}
              onMouseLeave={() => {
                if (!volumeSliderSupported || volumeDraggingRef.current) return;
                scheduleVolumePopupClose();
              }}
            >
              {volumeSliderSupported && volumePopupOpen ? (
                <div className="absolute bottom-full left-1/2 z-30 flex w-11 -translate-x-1/2 flex-col items-center pb-1">
                  <div className="rounded-lg bg-black/85 px-2.5 py-2 shadow-lg">
                    <div className="flex h-14 w-8 items-center justify-center">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={Math.round(volume * 100)}
                        aria-label={COPY.volume[uiLang]}
                        aria-orientation="vertical"
                        className="hosted-volume-slider h-1.5 w-14 -rotate-90 cursor-pointer accent-[#FE2C55]"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          volumeDraggingRef.current = true;
                          showControls();
                        }}
                        onPointerUp={(e) => {
                          e.stopPropagation();
                          volumeDraggingRef.current = false;
                          scheduleHide();
                        }}
                        onPointerCancel={() => {
                          volumeDraggingRef.current = false;
                          scheduleHide();
                        }}
                        onChange={(e) => {
                          e.stopPropagation();
                          setVolumeLevel(Number(e.target.value) / 100);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                aria-label={muted || showSound ? COPY.unmute[uiLang] : COPY.mute[uiLang]}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const coarse =
                    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
                  if (volumeSliderSupported && coarse && !volumePopupOpen) {
                    setVolumePopupOpen(true);
                    showControls();
                    return;
                  }
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
            <button
              type="button"
              data-hosted-expand="true"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              aria-label={lightbox ? COPY.shrink[uiLang] : COPY.expand[uiLang]}
              aria-pressed={expanded && !closing}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                expandOrToggle();
              }}
            >
              {lightbox ? (
                <Minimize2 className="h-6 w-6" strokeWidth={2.5} aria-hidden />
              ) : (
                <Maximize2 className="h-6 w-6" strokeWidth={2.5} aria-hidden />
              )}
            </button>
          </div>
        </div>
      </div>
      {showSound ? (
        <TikTokSoundPromptButton label={TIKTOK_SOUND_COPY[uiLang]} onClick={onTapForSound} />
      ) : null}
    </div>
    );
  };

  return (
    <>
      <div
        ref={slotRef}
        data-hosted-in-card="true"
        className="absolute inset-0 overflow-hidden bg-black"
        style={{ visibility: lightbox ? "hidden" : "visible" }}
      >
        {!lightbox ? renderPlayerShell(false) : null}
      </div>
      {mounted && lightbox
        ? createPortal(
            <>
              <div
                data-hosted-backdrop="true"
                className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-md"
                style={{
                  opacity: backdropOpen ? 1 : 0,
                  transition: reduceMotion ? "none" : `opacity ${ANIM_MS}ms ${ANIM_EASE}`,
                }}
                onClick={collapse}
              />
              {renderPlayerShell(true)}
            </>,
            document.body
          )
        : null}
    </>
  );
}
