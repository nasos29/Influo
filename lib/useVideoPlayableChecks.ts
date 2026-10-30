"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cleanVideoLink } from "@/lib/videoLinks";
import {
  VIDEO_CHECKING_LABEL,
  VIDEO_NOT_PLAYABLE_ERROR,
  normalizeVideoUrlKey,
} from "@/lib/checkVideoPlayable";
import { fetchCheckVideo } from "@/lib/fetchCheckVideo";

type Lang = "el" | "en";

export const VIDEO_CHECK_DEBOUNCE_MS = 600;

export function newVideoRowId(): string {
  return `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export type VideoRow = { id: string; url: string };

export function toVideoRows(urls: string[] | null | undefined): VideoRow[] {
  const list = Array.isArray(urls) && urls.length > 0 ? urls : [""];
  return list.map((url) => ({ id: newVideoRowId(), url: String(url || "") }));
}

export function videoRowsToUrls(rows: VideoRow[]): string[] {
  return rows.map((r) => r.url);
}

/**
 * Per-row playability checks for portfolio video URL inputs.
 * Keys are stable row ids (not array indexes) so typing never remounts inputs.
 * Skips URLs already present in `existingVideos` (normalized).
 */
export function useVideoPlayableChecks(
  lang: Lang,
  existingVideos: string[] = []
) {
  const uiLang = lang === "en" ? "en" : "el";
  const [checkingById, setCheckingById] = useState<Record<string, boolean>>({});
  const [errorById, setErrorById] = useState<Record<string, string | null>>({});
  const genByIdRef = useRef<Record<string, number>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const existingVideosRef = useRef(existingVideos);
  existingVideosRef.current = existingVideos;

  const existingKeys = useCallback(
    () =>
      new Set(
        (existingVideosRef.current || [])
          .map(normalizeVideoUrlKey)
          .filter(Boolean)
      ),
    []
  );

  const cancelScheduled = useCallback((id: string) => {
    const t = timersRef.current[id];
    if (t) {
      clearTimeout(t);
      delete timersRef.current[id];
    }
  }, []);

  const clearId = useCallback(
    (id: string) => {
      cancelScheduled(id);
      genByIdRef.current[id] = (genByIdRef.current[id] || 0) + 1;
      setCheckingById((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setErrorById((prev) => {
        if (prev[id] == null) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [cancelScheduled]
  );

  const clearAll = useCallback(() => {
    for (const id of Object.keys(timersRef.current)) {
      clearTimeout(timersRef.current[id]);
    }
    timersRef.current = {};
    genByIdRef.current = {};
    setCheckingById({});
    setErrorById({});
  }, []);

  useEffect(() => () => clearAll(), [clearAll]);

  const runCheck = useCallback(
    async (id: string, rawUrl: string) => {
      cancelScheduled(id);
      const cleaned = cleanVideoLink(rawUrl);
      if (!cleaned.ok) {
        clearId(id);
        return cleaned;
      }

      const key = normalizeVideoUrlKey(cleaned.url);
      if (existingKeys().has(key)) {
        clearId(id);
        return cleaned;
      }

      const gen = (genByIdRef.current[id] || 0) + 1;
      genByIdRef.current[id] = gen;
      setCheckingById((prev) => ({ ...prev, [id]: true }));
      setErrorById((prev) => {
        if (prev[id] == null) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });

      const result = await fetchCheckVideo(cleaned.url);
      if (genByIdRef.current[id] !== gen) {
        return cleaned;
      }

      setCheckingById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (!result.playable) {
        setErrorById((prev) => ({
          ...prev,
          [id]: VIDEO_NOT_PLAYABLE_ERROR[uiLang],
        }));
      } else {
        setErrorById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
      return cleaned;
    },
    [cancelScheduled, clearId, existingKeys, uiLang]
  );

  /** Debounced check (default 600ms). Call from onChange; blur should use runCheck. */
  const scheduleCheck = useCallback(
    (id: string, rawUrl: string, delayMs = VIDEO_CHECK_DEBOUNCE_MS) => {
      cancelScheduled(id);
      const trimmed = String(rawUrl || "").trim();
      if (!trimmed) {
        clearId(id);
        return;
      }
      // Clear prior error/checking immediately while typing.
      setCheckingById((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setErrorById((prev) => {
        if (prev[id] == null) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      timersRef.current[id] = setTimeout(() => {
        delete timersRef.current[id];
        void runCheck(id, rawUrl);
      }, delayMs);
    },
    [cancelScheduled, clearId, runCheck]
  );

  const isChecking = Object.values(checkingById).some(Boolean);
  const hasBlockingError = Object.values(errorById).some((e) => !!e);
  const checkingLabel = VIDEO_CHECKING_LABEL[uiLang];
  const notPlayableMessage = VIDEO_NOT_PLAYABLE_ERROR[uiLang];

  /** Re-check every non-empty URL that is new vs existing. Returns false if any fail. */
  const assertAllNewPlayable = useCallback(
    async (rows: VideoRow[] | string[]): Promise<boolean> => {
      const keys = existingKeys();
      const errors: Record<string, string | null> = {};
      let ok = true;
      const list: VideoRow[] = Array.isArray(rows)
        ? typeof rows[0] === "string"
          ? (rows as string[]).map((url, i) => ({
              id: `assert-${i}`,
              url,
            }))
          : (rows as VideoRow[])
        : [];

      for (const row of list) {
        const raw = row.url || "";
        if (!raw.trim()) continue;
        const cleaned = cleanVideoLink(raw);
        if (!cleaned.ok) continue;
        if (keys.has(normalizeVideoUrlKey(cleaned.url))) continue;
        setCheckingById((prev) => ({ ...prev, [row.id]: true }));
        const result = await fetchCheckVideo(cleaned.url);
        setCheckingById((prev) => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        });
        if (!result.playable) {
          errors[row.id] = VIDEO_NOT_PLAYABLE_ERROR[uiLang];
          ok = false;
        }
      }
      setErrorById((prev) => {
        const next = { ...prev };
        for (const [id, msg] of Object.entries(errors)) {
          if (msg) next[id] = msg;
          else delete next[id];
        }
        return next;
      });
      return ok;
    },
    [existingKeys, uiLang]
  );

  return {
    checkingById,
    errorById,
    /** @deprecated use checkingById */
    checkingByIndex: checkingById as unknown as Record<number, boolean>,
    /** @deprecated use errorById */
    errorByIndex: errorById as unknown as Record<number, string | null>,
    isChecking,
    hasBlockingError,
    checkingLabel,
    notPlayableMessage,
    runCheck,
    scheduleCheck,
    clearId,
    /** @deprecated use clearId */
    clearIndex: clearId as unknown as (i: number) => void,
    clearAll,
    assertAllNewPlayable,
  };
}
