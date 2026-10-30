"use client";

import { useCallback, useRef, useState } from "react";
import { cleanVideoLink } from "@/lib/videoLinks";
import {
  VIDEO_CHECKING_LABEL,
  VIDEO_NOT_PLAYABLE_ERROR,
  normalizeVideoUrlKey,
} from "@/lib/checkVideoPlayable";
import { fetchCheckVideo } from "@/lib/fetchCheckVideo";

type Lang = "el" | "en";

/**
 * Per-index playability checks for portfolio video URL inputs.
 * Skips URLs already present in `existingVideos` (normalized).
 */
export function useVideoPlayableChecks(
  lang: Lang,
  existingVideos: string[] = []
) {
  const uiLang = lang === "en" ? "en" : "el";
  const [checkingByIndex, setCheckingByIndex] = useState<Record<number, boolean>>({});
  const [errorByIndex, setErrorByIndex] = useState<Record<number, string | null>>({});
  const genRef = useRef(0);

  const existingKeys = () =>
    new Set((existingVideos || []).map(normalizeVideoUrlKey).filter(Boolean));

  const clearIndex = useCallback((i: number) => {
    setCheckingByIndex((prev) => {
      if (!prev[i]) return prev;
      const next = { ...prev };
      delete next[i];
      return next;
    });
    setErrorByIndex((prev) => {
      if (prev[i] == null) return prev;
      const next = { ...prev };
      delete next[i];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setCheckingByIndex({});
    setErrorByIndex({});
  }, []);

  const runCheck = useCallback(
    async (i: number, rawUrl: string) => {
      const cleaned = cleanVideoLink(rawUrl);
      if (!cleaned.ok) {
        clearIndex(i);
        return cleaned;
      }

      const key = normalizeVideoUrlKey(cleaned.url);
      if (existingKeys().has(key)) {
        clearIndex(i);
        return cleaned;
      }

      const gen = ++genRef.current;
      setCheckingByIndex((prev) => ({ ...prev, [i]: true }));
      setErrorByIndex((prev) => ({ ...prev, [i]: null }));

      const result = await fetchCheckVideo(cleaned.url);
      if (gen !== genRef.current) {
        /* superseded */
      }
      setCheckingByIndex((prev) => {
        const next = { ...prev };
        delete next[i];
        return next;
      });
      if (!result.playable) {
        setErrorByIndex((prev) => ({
          ...prev,
          [i]: VIDEO_NOT_PLAYABLE_ERROR[uiLang],
        }));
      } else {
        setErrorByIndex((prev) => {
          const next = { ...prev };
          delete next[i];
          return next;
        });
      }
      return cleaned;
    },
    // existingVideos identity changes often; read via closure intentionally
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clearIndex, uiLang, existingVideos]
  );

  const isChecking = Object.values(checkingByIndex).some(Boolean);
  const hasBlockingError = Object.values(errorByIndex).some((e) => !!e);
  const checkingLabel = VIDEO_CHECKING_LABEL[uiLang];
  const notPlayableMessage = VIDEO_NOT_PLAYABLE_ERROR[uiLang];

  /** Re-check every non-empty URL that is new vs existing. Returns false if any fail. */
  const assertAllNewPlayable = useCallback(
    async (videos: string[]): Promise<boolean> => {
      const keys = existingKeys();
      const errors: Record<number, string | null> = {};
      let ok = true;
      for (let i = 0; i < videos.length; i++) {
        const raw = videos[i] || "";
        if (!raw.trim()) continue;
        const cleaned = cleanVideoLink(raw);
        if (!cleaned.ok) continue;
        if (keys.has(normalizeVideoUrlKey(cleaned.url))) continue;
        setCheckingByIndex((prev) => ({ ...prev, [i]: true }));
        const result = await fetchCheckVideo(cleaned.url);
        setCheckingByIndex((prev) => {
          const next = { ...prev };
          delete next[i];
          return next;
        });
        if (!result.playable) {
          errors[i] = VIDEO_NOT_PLAYABLE_ERROR[uiLang];
          ok = false;
        }
      }
      setErrorByIndex((prev) => ({ ...prev, ...errors }));
      return ok;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uiLang, existingVideos]
  );

  return {
    checkingByIndex,
    errorByIndex,
    isChecking,
    hasBlockingError,
    checkingLabel,
    notPlayableMessage,
    runCheck,
    clearIndex,
    clearAll,
    assertAllNewPlayable,
  };
}
