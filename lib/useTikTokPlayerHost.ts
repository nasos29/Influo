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
  postTikTokPlayer,
  TIKTOK_PLAYER_ORIGIN,
} from "@/lib/tikTokPlayer";

const UNMUTE_FALLBACK_MS = 1500;

export const TIKTOK_SOUND_COPY = {
  el: "Ενεργοποίηση ήχου",
  en: "Tap for sound",
} as const;

function tikTokPlayerErrorCode(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "code" in value) {
    const code = (value as { code: unknown }).code;
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
  const unmutedRef = useRef(false);
  const triedUnmuteRef = useRef(false);
  const errorRetriedRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    triedUnmuteRef.current = true;
    postTikTokPlayer(iframeRef.current, "unMute");
    postTikTokPlayer(iframeRef.current, "play");
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
      setShowSoundPrompt(false);
      clearFallback();
    }
  }, [clearFallback, enabled]);

  useLayoutEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== TIKTOK_PLAYER_ORIGIN) return;
      if (!isTikTokPlayerMessage(event.data)) return;
      if (!enabledRef.current) return;

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
  }, [clearFallback, tryUnmuteAndPlay]);

  const onTapForSound = useCallback(() => {
    postTikTokPlayer(iframeRef.current, "unMute");
    postTikTokPlayer(iframeRef.current, "play");
    unmutedRef.current = true;
    setShowSoundPrompt(false);
    clearFallback();
  }, [clearFallback, iframeRef]);

  return { iframeRef, showSoundPrompt, onTapForSound };
}