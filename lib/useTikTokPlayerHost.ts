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
import {
  isFatalTikTokPlayerError,
  isRetryableTikTokPlayerError,
  isTikTokPlayerOverloadError,
  shouldUnloadTikTokPlayer,
  tikTokPlayerErrorCode,
} from "@/lib/tikTokPlayerErrors";

export {
  isFatalTikTokPlayerError,
  isRetryableTikTokPlayerError,
  isTikTokPlayerOverloadError,
  shouldUnloadTikTokPlayer,
  tikTokPlayerErrorCode,
} from "@/lib/tikTokPlayerErrors";

const UNMUTE_FALLBACK_MS = 1500;
const PLAYBACK_RETRY_MS = 400;

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

/**
 * Host TikTok player/v1 iframe: after onPlayerReady (or first onStateChange),
 * send unMute + play. If still muted after ~1.5s, expose a Tap-for-sound prompt.
 *
 * Automatic retries are limited to one delayed play() for 3001. 3002 stays
 * on the sound prompt (needs a user gesture). Overload / SDK errors unload
 * the iframe instead of leaving TikTok's "Player error" UI or hammering
 * the player. TikTok emits onPlayerReady together with 2005 — we must not
 * treat that as a cue to play() again.
 */
export function useTikTokPlayerHost(
  enabled: boolean,
  externalIframeRef?: RefObject<HTMLIFrameElement | null>
) {
  const localRef = useRef<HTMLIFrameElement>(null);
  const iframeRef = externalIframeRef ?? localRef;
  const [showSoundPrompt, setShowSoundPrompt] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [unplayable, setUnplayable] = useState(false);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const unmutedRef = useRef(false);
  const triedUnmuteRef = useRef(false);
  const errorRetriedRef = useRef(false);
  const playbackFailedRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeLoadedRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const clearFallback = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const markPlaybackFailed = useCallback(() => {
    playbackFailedRef.current = true;
    setPlaybackFailed(true);
    setShowSoundPrompt(false);
    setIsPlaying(false);
    clearFallback();
    clearRetry();
  }, [clearFallback, clearRetry]);

  const tryUnmuteAndPlay = useCallback(() => {
    if (unmutedRef.current || playbackFailedRef.current) return;
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
      if (!unmutedRef.current && !playbackFailedRef.current) setShowSoundPrompt(true);
    }, UNMUTE_FALLBACK_MS);
  }, [clearFallback, iframeRef]);

  useEffect(() => {
    if (!enabled) {
      unmutedRef.current = false;
      triedUnmuteRef.current = false;
      errorRetriedRef.current = false;
      playbackFailedRef.current = false;
      iframeLoadedRef.current = false;
      setShowSoundPrompt(false);
      setIsPlaying(false);
      setUnplayable(false);
      setPlaybackFailed(false);
      clearFallback();
      clearRetry();
    }
  }, [clearFallback, clearRetry, enabled]);

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
        if (isFatalTikTokPlayerError(value)) {
          setUnplayable(true);
          setShowSoundPrompt(false);
          clearFallback();
          clearRetry();
          return;
        }
        // 2005 also emits onPlayerReady; latch failure first so we never play().
        if (isTikTokPlayerOverloadError(value) || shouldUnloadTikTokPlayer(value, errorRetriedRef.current)) {
          markPlaybackFailed();
          return;
        }
        if (isRetryableTikTokPlayerError(tikTokPlayerErrorCode(value)) && !errorRetriedRef.current) {
          errorRetriedRef.current = true;
          triedUnmuteRef.current = false;
          clearRetry();
          retryTimerRef.current = setTimeout(() => {
            tryUnmuteAndPlay();
          }, PLAYBACK_RETRY_MS);
          return;
        }
        // 3002 AUTOPLAY_ERROR: keep the iframe, wait for a real tap.
        setShowSoundPrompt(true);
        return;
      }

      if (type === "onStateChange") {
        const playing = tikTokPlayingState(value);
        if (playing != null) setIsPlaying(playing);
      }

      if (type === "onPlayerReady" || type === "onStateChange") {
        if (playbackFailedRef.current) return;
        iframeLoadedRef.current = true;
        if (!triedUnmuteRef.current) tryUnmuteAndPlay();
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      clearFallback();
      clearRetry();
    };
  }, [clearFallback, clearRetry, iframeRef, markPlaybackFailed, tryUnmuteAndPlay]);

  const onTapForSound = useCallback(() => {
    if (playbackFailedRef.current) return;
    postTikTokPlayer(iframeRef.current, "unMute");
    postTikTokPlayer(iframeRef.current, "play");
    unmutedRef.current = true;
    setShowSoundPrompt(false);
    clearFallback();
  }, [clearFallback, iframeRef]);

  return {
    iframeRef,
    showSoundPrompt,
    isPlaying,
    unplayable,
    playbackFailed,
    onTapForSound,
    onIframeLoad,
  };
}
