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
  isInvalidTikTokVideoError,
  isTikTokPlayerOverloadError,
  logTikTokPlayerMessage,
  shouldFallbackToTikTokEmbed,
  shouldUnloadTikTokPlayer,
  TIKTOK_PLAYER_READY_TIMEOUT_MS,
} from "@/lib/tikTokPlayerErrors";

export {
  isFatalTikTokPlayerError,
  isInvalidTikTokVideoError,
  isRetryableTikTokPlayerError,
  isTikTokPlayerOverloadError,
  shouldFallbackToTikTokEmbed,
  shouldUnloadTikTokPlayer,
  tikTokPlayerErrorCode,
  nextTikTokSilentRetryDelay,
  TIKTOK_LIMIT_RETRY_BACKOFF_MS,
  TIKTOK_PLAYER_READY_TIMEOUT_MS,
} from "@/lib/tikTokPlayerErrors";

/** Show "tap for sound" if unmute is not confirmed. Do not send a second play(). */
export const TIKTOK_SOUND_PROMPT_MS = 4000;

/** Official host→player commands must wait for this event. */
export function isTikTokPlayerReadyEvent(type: string): boolean {
  return type === "onPlayerReady";
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
 * Host TikTok player/v1 iframe. A user tap on Play is a gesture: try unmuted
 * play first (muted=0 URL + unMute/play on ready). If the browser blocks it,
 * fall back to muted playback and the existing Tap-for-sound button.
 *
 * Temporary 3001/1004/2005/2001, or a player/v1 ready-timeout: fall back
 * to embed/v2 immediately (no 2s/5s remount). Do not send a second play()
 * on a failing iframe. No pre-warm. 3002 stays muted with the play/sound
 * prompt. 1001 is reported as invalidVideo so the card can confirm via
 * oEmbed before any swap. Playback errors never hide or replace the post.
 * When the iframe is already embed/v2, a further player error surfaces
 * cover + Retry instead of looping.
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
  const [invalidVideo, setInvalidVideo] = useState(false);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const [fallbackToEmbed, setFallbackToEmbed] = useState(false);
  const [playerReloadNonce, setPlayerReloadNonce] = useState(0);
  const unmutedRef = useRef(false);
  const triedUnmuteRef = useRef(false);
  const errorRetriedRef = useRef(false);
  const playbackFailedRef = useRef(false);
  const fallbackToEmbedRef = useRef(false);
  const silentRetryCountRef = useRef(0);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limitRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeLoadedRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const clearLimitRetry = useCallback(() => {
    if (limitRetryTimerRef.current) {
      clearTimeout(limitRetryTimerRef.current);
      limitRetryTimerRef.current = null;
    }
  }, []);

  const clearReadyTimeout = useCallback(() => {
    if (readyTimeoutRef.current) {
      clearTimeout(readyTimeoutRef.current);
      readyTimeoutRef.current = null;
    }
  }, []);

  const clearFallback = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const markPlaybackFailed = useCallback(() => {
    playbackFailedRef.current = true;
    setPlaybackFailed(true);
    setShowSoundPrompt(false);
    setIsPlaying(false);
    clearFallback();
    clearLimitRetry();
    clearReadyTimeout();
  }, [clearFallback, clearLimitRetry, clearReadyTimeout]);

  const markFallbackToEmbed = useCallback(() => {
    fallbackToEmbedRef.current = true;
    setFallbackToEmbed(true);
    setShowSoundPrompt(false);
    clearFallback();
    clearLimitRetry();
    clearReadyTimeout();
  }, [clearFallback, clearLimitRetry, clearReadyTimeout]);

  const scheduleSilentRetryOrFallback = useCallback(() => {
    if (fallbackToEmbedRef.current || playbackFailedRef.current) return;
    const src = iframeRef.current?.getAttribute("src") || iframeRef.current?.src || "";
    // Already on embed/v2: do not remount player/v1 or loop the fallback.
    if (/tiktok\.com\/embed\/v2\//i.test(src)) {
      logTikTokPlayerMessage("embedPlaybackFailed");
      markPlaybackFailed();
      return;
    }
    logTikTokPlayerMessage("immediateEmbedFallback");
    markFallbackToEmbed();
  }, [iframeRef, markFallbackToEmbed, markPlaybackFailed]);

  const playerReadyRef = useRef(false);

  const tryUnmuteAndPlay = useCallback(() => {
    if (unmutedRef.current || playbackFailedRef.current || fallbackToEmbedRef.current) return;
    // iframe onLoad is not enough — wait for the official onPlayerReady message.
    if (!playerReadyRef.current) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const src = iframe.getAttribute("src") || iframe.src || "";
    if (!isTikTokPlayerIframeSrc(src)) return;
    if (triedUnmuteRef.current) return;
    triedUnmuteRef.current = true;
    // Play was a user tap — try unmuted first. If sound never confirms,
    // show the existing Tap-for-sound button. Do not send play() again:
    // a second command on a slow mobile CPU often lands mid-init (3001).
    postTikTokPlayer(iframe, "unMute");
    postTikTokPlayer(iframe, "play");
    clearFallback();
    fallbackTimerRef.current = setTimeout(() => {
      if (unmutedRef.current || playbackFailedRef.current || fallbackToEmbedRef.current) return;
      setShowSoundPrompt(true);
    }, TIKTOK_SOUND_PROMPT_MS);
  }, [clearFallback, iframeRef]);

  useEffect(() => {
    if (!enabled) {
      unmutedRef.current = false;
      triedUnmuteRef.current = false;
      errorRetriedRef.current = false;
      playbackFailedRef.current = false;
      fallbackToEmbedRef.current = false;
      silentRetryCountRef.current = 0;
      iframeLoadedRef.current = false;
      playerReadyRef.current = false;
      setShowSoundPrompt(false);
      setIsPlaying(false);
      setUnplayable(false);
      setInvalidVideo(false);
      setPlaybackFailed(false);
      setFallbackToEmbed(false);
      setPlayerReloadNonce(0);
      clearFallback();
      clearLimitRetry();
      clearReadyTimeout();
    }
  }, [clearFallback, clearLimitRetry, clearReadyTimeout, enabled]);

  const onIframeLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const src = iframe.getAttribute("src") || iframe.src || "";
    if (isTikTokPlayerIframeSrc(src)) {
      iframeLoadedRef.current = true;
      if (playerReadyRef.current || fallbackToEmbedRef.current || playbackFailedRef.current) {
        return;
      }
      // embed/v2 may not emit onPlayerReady; still try unmute/play for sound.
      if (/tiktok\.com\/embed\/v2\//i.test(src)) {
        playerReadyRef.current = true;
        if (!triedUnmuteRef.current) tryUnmuteAndPlay();
        return;
      }
      clearReadyTimeout();
      readyTimeoutRef.current = setTimeout(() => {
        if (playerReadyRef.current || playbackFailedRef.current || fallbackToEmbedRef.current) {
          return;
        }
        logTikTokPlayerMessage("onPlayerReadyTimeout");
        markFallbackToEmbed();
      }, TIKTOK_PLAYER_READY_TIMEOUT_MS);
    }
  }, [clearReadyTimeout, iframeRef, markFallbackToEmbed, tryUnmuteAndPlay]);

  useLayoutEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== TIKTOK_PLAYER_ORIGIN) return;
      if (!isTikTokPlayerMessage(event.data)) return;
      if (!enabledRef.current) return;

      const iframe = iframeRef.current;
      const frameWin = iframe?.contentWindow;
      if (!frameWin || event.source !== frameWin) return;

      const { type, value } = event.data;

      if (type === "onPlayerError" || type === "onError") {
        logTikTokPlayerMessage(type, value);
      }

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
          setInvalidVideo(isInvalidTikTokVideoError(value));
          setUnplayable(true);
          setShowSoundPrompt(false);
          clearFallback();
          clearLimitRetry();
          clearReadyTimeout();
          return;
        }
        // Temporary 3001/1004/2005/2001: fall back to embed/v2 immediately.
        if (shouldFallbackToTikTokEmbed(value, errorRetriedRef.current)) {
          scheduleSilentRetryOrFallback();
          return;
        }
        if (isTikTokPlayerOverloadError(value) || shouldUnloadTikTokPlayer(value, errorRetriedRef.current)) {
          markPlaybackFailed();
          return;
        }
        // 3002 AUTOPLAY_ERROR: keep the iframe muted and show play/sound,
        // never surface a player error.
        postTikTokPlayer(iframe, "mute");
        postTikTokPlayer(iframe, "play");
        setShowSoundPrompt(true);
        return;
      }

      if (type === "onStateChange") {
        // ended(0) / paused(2): local UI only. Never claim, release, or pause-all.
        const playing = tikTokPlayingState(value);
        if (playing != null) setIsPlaying(playing);
        return;
      }

      if (isTikTokPlayerReadyEvent(type)) {
        if (playbackFailedRef.current || fallbackToEmbedRef.current) return;
        // onPlayerReady (not iframe load, not onStateChange) is the official
        // cue that the SDK will accept play / unMute.
        iframeLoadedRef.current = true;
        playerReadyRef.current = true;
        clearReadyTimeout();
        if (!triedUnmuteRef.current) tryUnmuteAndPlay();
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      clearFallback();
      clearLimitRetry();
      clearReadyTimeout();
    };
  }, [
    clearFallback,
    clearLimitRetry,
    clearReadyTimeout,
    iframeRef,
    markFallbackToEmbed,
    markPlaybackFailed,
    scheduleSilentRetryOrFallback,
    tryUnmuteAndPlay,
  ]);

  const onTapForSound = useCallback(() => {
    if (playbackFailedRef.current || fallbackToEmbedRef.current) return;
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
    invalidVideo,
    playbackFailed,
    fallbackToEmbed,
    playerReloadNonce,
    onTapForSound,
    onIframeLoad,
  };
}
