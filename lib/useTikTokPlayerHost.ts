"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  isTikTokPlayerMessage,
  isTikTokPlayerIframeSrc,
  postTikTokPlayer,
  TIKTOK_PLAYER_ORIGIN,
} from "@/lib/tikTokPlayer";

const UNMUTE_FALLBACK_MS = 1500;

/** iOS / coarse pointers typically block unmute without a fresh user gesture. */
function isTouchLikePlayback(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  const touch = "ontouchstart" in window || (navigator.maxTouchPoints ?? 0) > 0;
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1);
  return Boolean(coarse || touch || ios);
}

function tikTokPlayingState(value: unknown): boolean | null {
  const raw =
    typeof value === "number"
      ? value
      : value && typeof value === "object"
        ? (value as { state?: unknown; value?: unknown; code?: unknown }).state ??
          (value as { value?: unknown }).value
        : null;
  if (typeof raw !== "number") return null;
  // TikTok embed-player: 1 playing, 3 buffering; 2 paused, 0 ended, -1 unstarted.
  if (raw === 1 || raw === 3) return true;
  if (raw === 2 || raw === 0 || raw === -1) return false;
  return null;
}

export const TIKTOK_SOUND_COPY = {
  el: "Ενεργοποίηση ήχου",
  en: "Tap for sound",
} as const;

function tikTokPlayerErrorCode(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    const rec = value as { code?: unknown; errorCode?: unknown };
    const code = rec.errorCode ?? rec.code;
    if (typeof code === "number") return code;
  }
  return null;
}

/**
 * Host TikTok player/v1 iframe: after onPlayerReady (or first onStateChange),
 * send unMute + play. If still muted after ~1.5s, expose a Tap-for-sound prompt.
 */
export function useTikTokPlayerHost(
  enabled: boolean,
  externalIframeRef?: RefObject<HTMLIFrameElement | null>
) {
  const localRef = useRef<HTMLIFrameElement>(null);
  const iframeRef = externalIframeRef ?? localRef;
  const [showSoundPrompt, setShowSoundPrompt] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const unmutedRef = useRef(false);
  const triedUnmuteRef = useRef(false);
  const errorRetriedRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeLoadedRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const clearFallback = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const tryUnmuteAndPlay = useCallback(() => {
    if (unmutedRef.current) return;
    const iframe = iframeRef.current;
    if (!iframe || !iframeLoadedRef.current) return;
    const src = iframe.getAttribute("src") || iframe.src || "";
    if (!isTikTokPlayerIframeSrc(src)) return;
    triedUnmuteRef.current = true;
    // On touch, keep the embed muted and wait for a real tap to unmute.
    // Auto-unmute here is async (after onPlayerReady) and often pauses iOS playback.
    if (isTouchLikePlayback()) {
      postTikTokPlayer(iframe, "play");
      setShowSoundPrompt(true);
      return;
    }
    postTikTokPlayer(iframe, "unMute");
    postTikTokPlayer(iframe, "play");
    clearFallback();
    fallbackTimerRef.current = setTimeout(() => {
      if (!unmutedRef.current) setShowSoundPrompt(true);
    }, UNMUTE_FALLBACK_MS);
  }, [clearFallback, iframeRef]);

  useEffect(() => {
    if (!enabled) {
      unmutedRef.current = false;
      triedUnmuteRef.current = false;
      errorRetriedRef.current = false;
      iframeLoadedRef.current = false;
      setShowSoundPrompt(false);
      setIsPlaying(false);
      clearFallback();
    }
  }, [clearFallback, enabled]);

  const onIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const src = iframe.getAttribute("src") || iframe.src || "";
    if (isTikTokPlayerIframeSrc(src)) {
      iframeLoadedRef.current = true;
    }
  }, [iframeRef]);

  useLayoutEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== TIKTOK_PLAYER_ORIGIN) return;
      if (!isTikTokPlayerMessage(event.data)) return;
      if (!enabledRef.current) return;

      const iframe = iframeRef.current;
      const frameWin = iframe?.contentWindow;
      if (!frameWin || event.source !== frameWin) return;

      const { type, value } = event.data;

      if (type === "onMute") {
        if (value === false) {
          unmutedRef.current = true;
          setShowSoundPrompt(false);
          clearFallback();
        }
        return;
      }

      if (type === "onPlayerError") {
        const code = tikTokPlayerErrorCode(value);
        if (
          (code === 3001 || code === 3002) &&
          !errorRetriedRef.current
        ) {
          errorRetriedRef.current = true;
          triedUnmuteRef.current = false;
          tryUnmuteAndPlay();
        }
        return;
      }

      if (type === "onStateChange") {
        const playing = tikTokPlayingState(value);
        if (playing != null) setIsPlaying(playing);
      }

      if (type === "onPlayerReady" || type === "onStateChange") {
        iframeLoadedRef.current = true;
        if (!triedUnmuteRef.current) tryUnmuteAndPlay();
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      clearFallback();
    };
  }, [clearFallback, tryUnmuteAndPlay]);

  const onTapForSound = useCallback(() => {
    postTikTokPlayer(iframeRef.current, "unMute");
    postTikTokPlayer(iframeRef.current, "play");
    unmutedRef.current = true;
    setShowSoundPrompt(false);
    clearFallback();
  }, [clearFallback, iframeRef]);

  return { iframeRef, showSoundPrompt, isPlaying, onTapForSound, onIframeLoad };
}
