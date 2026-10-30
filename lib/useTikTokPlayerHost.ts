"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isTikTokPlayerMessage,
  postTikTokPlayer,
  TIKTOK_PLAYER_ORIGIN,
} from "@/lib/tikTokPlayer";

const UNMUTE_FALLBACK_MS = 1500;

export const TIKTOK_SOUND_COPY = {
  el: "Ενεργοποίηση ήχου",
  en: "Tap for sound",
} as const;

/**
 * Host TikTok player/v1 iframe: after onPlayerReady (or first onStateChange),
 * send unMute + play. If still muted after ~1.5s, expose a Tap-for-sound prompt.
 */
export function useTikTokPlayerHost(enabled: boolean) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [showSoundPrompt, setShowSoundPrompt] = useState(false);
  const unmutedRef = useRef(false);
  const triedUnmuteRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFallback = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const tryUnmuteAndPlay = useCallback(() => {
    if (unmutedRef.current) return;
    triedUnmuteRef.current = true;
    postTikTokPlayer(iframeRef.current, "unMute");
    postTikTokPlayer(iframeRef.current, "play");
    clearFallback();
    fallbackTimerRef.current = setTimeout(() => {
      if (!unmutedRef.current) setShowSoundPrompt(true);
    }, UNMUTE_FALLBACK_MS);
  }, [clearFallback]);

  useEffect(() => {
    if (!enabled) {
      unmutedRef.current = false;
      triedUnmuteRef.current = false;
      setShowSoundPrompt(false);
      clearFallback();
      return;
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== TIKTOK_PLAYER_ORIGIN) return;
      if (!isTikTokPlayerMessage(event.data)) return;

      const { type, value } = event.data;

      if (type === "onMute") {
        if (value === false) {
          unmutedRef.current = true;
          setShowSoundPrompt(false);
          clearFallback();
        }
        return;
      }

      if (
        (type === "onPlayerReady" || type === "onStateChange") &&
        !triedUnmuteRef.current
      ) {
        tryUnmuteAndPlay();
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      clearFallback();
    };
  }, [clearFallback, enabled, tryUnmuteAndPlay]);

  const onTapForSound = useCallback(() => {
    postTikTokPlayer(iframeRef.current, "unMute");
    postTikTokPlayer(iframeRef.current, "play");
    unmutedRef.current = true;
    setShowSoundPrompt(false);
    clearFallback();
  }, [clearFallback]);

  return { iframeRef, showSoundPrompt, onTapForSound };
}
