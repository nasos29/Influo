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
  isTikTokPlayerOverloadError,
  logTikTokPlayerMessage,
  shouldFallbackToTikTokEmbed,
  shouldUnloadTikTokPlayer,
} from "@/lib/tikTokPlayerErrors";

export {
  isFatalTikTokPlayerError,
  isRetryableTikTokPlayerError,
  isTikTokPlayerOverloadError,
  shouldFallbackToTikTokEmbed,
  shouldUnloadTikTokPlayer,
  tikTokPlayerErrorCode,
} from "@/lib/tikTokPlayerErrors";

const UNMUTE_FALLBACK_MS = 1500;

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
 * 3001/1004/2005/2001 fall back to embed/v2 once (see SocialEmbedCard).
 * There is no automatic play() retry. 3002 stays muted with the play/sound
 * prompt rather than an error. TikTok emits onPlayerReady with 2005 — we
 * must not treat that as a cue to play() again.
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
  const [fallbackToEmbed, setFallbackToEmbed] = useState(false);
  const unmutedRef = useRef(false);
  const triedUnmuteRef = useRef(false);
  const errorRetriedRef = useRef(false);
  const playbackFailedRef = useRef(false);
  const fallbackToEmbedRef = useRef(false);
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

  const markPlaybackFailed = useCallback(() => {
    playbackFailedRef.current = true;
    setPlaybackFailed(true);
    setShowSoundPrompt(false);
    setIsPlaying(false);
    clearFallback();
  }, [clearFallback]);

  const markFallbackToEmbed = useCallback(() => {
    fallbackToEmbedRef.current = true;
    setFallbackToEmbed(true);
    setShowSoundPrompt(false);
    clearFallback();
  }, [clearFallback]);

  const tryUnmuteAndPlay = useCallback(() => {
    if (unmutedRef.current || playbackFailedRef.current || fallbackToEmbedRef.current) return;
    const iframe = iframeRef.current;
    if (!iframe || !iframeLoadedRef.current) return;
    const src = iframe.getAttribute("src") || iframe.src || "";
    if (!isTikTokPlayerIframeSrc(src)) return;
    triedUnmuteRef.current = true;
    // Play was a user tap — try unmuted first. If the browser blocks it,
    // the mute fallback below keeps the existing Tap-for-sound button.
    postTikTokPlayer(iframe, "unMute");
    postTikTokPlayer(iframe, "play");
    clearFallback();
    fallbackTimerRef.current = setTimeout(() => {
      if (unmutedRef.current || playbackFailedRef.current || fallbackToEmbedRef.current) return;
      postTikTokPlayer(iframe, "mute");
      postTikTokPlayer(iframe, "play");
      setShowSoundPrompt(true);
    }, UNMUTE_FALLBACK_MS);
  }, [clearFallback, iframeRef]);

  useEffect(() => {
    if (!enabled) {
      unmutedRef.current = false;
      triedUnmuteRef.current = false;
      errorRetriedRef.current = false;
      playbackFailedRef.current = false;
      fallbackToEmbedRef.current = false;
      iframeLoadedRef.current = false;
      setShowSoundPrompt(false);
      setIsPlaying(false);
      setUnplayable(false);
      setPlaybackFailed(false);
      setFallbackToEmbed(false);
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
          setUnplayable(true);
          setShowSoundPrompt(false);
          clearFallback();
          return;
        }
        // Any player/v1 failure except 3002 (including 2005/2001/3001) tries
        // embed/v2 once before we unload back to the cover. No play() retry.
        if (shouldFallbackToTikTokEmbed(value, errorRetriedRef.current)) {
          markFallbackToEmbed();
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
        const playing = tikTokPlayingState(value);
        if (playing != null) setIsPlaying(playing);
      }

      if (type === "onPlayerReady" || type === "onStateChange") {
        if (playbackFailedRef.current || fallbackToEmbedRef.current) return;
        iframeLoadedRef.current = true;
        if (!triedUnmuteRef.current) tryUnmuteAndPlay();
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      clearFallback();
    };
  }, [clearFallback, iframeRef, markFallbackToEmbed, markPlaybackFailed, tryUnmuteAndPlay]);

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
    playbackFailed,
    fallbackToEmbed,
    onTapForSound,
    onIframeLoad,
  };
}
