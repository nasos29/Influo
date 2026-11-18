"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildTikTokEmbedUrl,
  buildTikTokPlayerUrl,
  cachedTikTokVideoId,
  extractTikTokVideoId,
  rememberTikTokVideoId,
  TIKTOK_IFRAME_ALLOW,
  tikTokEmbedIframeSandbox,
} from "@/lib/tikTokPlayer";
import { TIKTOK_SOUND_COPY, useTikTokPlayerHost } from "@/lib/useTikTokPlayerHost";
import {
  claimTikTokPlayerSession,
  TIKTOK_PLAYER_SESSION_EVENT,
  type TikTokPlayerSessionDetail,
} from "@/lib/tikTokPlayerSession";
import TikTokSoundPromptButton from "@/components/TikTokSoundPromptButton";

const COPY = {
  close: { el: "Κλείσιμο", en: "Close" },
  title: { el: "Βίντεο TikTok", en: "TikTok video" },
  loading: { el: "Φόρτωση", en: "Loading" },
  error: { el: "Το βίντεο δεν είναι διαθέσιμο", en: "This video is unavailable" },
} as const;

type Lang = "el" | "en";

export default function TikTokPlayerModal({
  open,
  videoId,
  originalUrl,
  lang = "el",
  onClose,
}: {
  open: boolean;
  videoId?: string | null;
  originalUrl?: string;
  lang?: Lang;
  onClose: () => void;
}) {
  const uiLang: Lang = lang === "en" ? "en" : "el";
  const sessionId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const hostIframeRef = useRef<HTMLIFrameElement | null>(null);
  const fallbackUsedRef = useRef(false);
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isPlayer =
    !!iframeSrc && /tiktok\.com\/player\/v1\//i.test(iframeSrc);
  const isEmbed =
    !!iframeSrc && /tiktok\.com\/embed\/v2\//i.test(iframeSrc);
  const {
    iframeRef: tikTokIframeRef,
    showSoundPrompt,
    onTapForSound,
    onIframeLoad,
    fallbackToEmbed,
    playbackFailed,
  } = useTikTokPlayerHost(isPlayer, hostIframeRef);

  useEffect(() => {
    if (!open) {
      setResolvedId(null);
      setIframeSrc(null);
      setResolveError(false);
      fallbackUsedRef.current = false;
      return;
    }
    const known =
      (videoId && /^\d+$/.test(videoId) ? videoId : null) ||
      (originalUrl ? cachedTikTokVideoId(originalUrl) : null);
    if (known) {
      setResolvedId(known);
      setResolveError(false);
      return;
    }
    if (!originalUrl) {
      setResolveError(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/video-embed?url=${encodeURIComponent(originalUrl)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { embed_url?: string };
        const id = extractTikTokVideoId(String(data.embed_url || ""));
        if (!id) throw new Error("Missing TikTok video id");
        rememberTikTokVideoId(originalUrl, id);
        if (!cancelled) {
          setResolvedId(id);
          setResolveError(false);
        }
      } catch {
        if (!cancelled) setResolveError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, originalUrl, videoId]);

  useEffect(() => {
    if (!open || !resolvedId) {
      setIframeSrc(null);
      fallbackUsedRef.current = false;
      return;
    }
    fallbackUsedRef.current = false;
    setIframeSrc(buildTikTokPlayerUrl(resolvedId, { muted: false }));
  }, [open, resolvedId]);

  useEffect(() => {
    if (!fallbackToEmbed || fallbackUsedRef.current || !resolvedId) return;
    fallbackUsedRef.current = true;
    setIframeSrc(buildTikTokEmbedUrl(resolvedId));
  }, [fallbackToEmbed, resolvedId]);

  useEffect(() => {
    if (!playbackFailed || fallbackUsedRef.current || !resolvedId) return;
    fallbackUsedRef.current = true;
    setIframeSrc(buildTikTokEmbedUrl(resolvedId));
  }, [playbackFailed, resolvedId]);

  useEffect(() => {
    if (!open || !iframeSrc) return;
    claimTikTokPlayerSession(sessionId);
    const onClaim = (event: Event) => {
      const detail = (event as CustomEvent<TikTokPlayerSessionDetail>).detail;
      if (!detail || detail.id === sessionId) return;
      onClose();
    };
    window.addEventListener(TIKTOK_PLAYER_SESSION_EVENT, onClaim);
    return () => window.removeEventListener(TIKTOK_PLAYER_SESSION_EVENT, onClaim);
  }, [iframeSrc, onClose, open, sessionId]);

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    window.history.pushState({ influoTikTokPlayerModal: true }, "");
    let closedByPop = false;
    const onPop = () => {
      closedByPop = true;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      if (!closedByPop && window.history.state?.influoTikTokPlayerModal) {
        window.history.back();
      }
    };
  }, [open, onClose]);

  const assignIframeRef = useCallback(
    (el: HTMLIFrameElement | null) => {
      hostIframeRef.current = el;
      tikTokIframeRef.current = el;
    },
    [tikTokIframeRef]
  );

  if (!mounted || !open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={COPY.title[uiLang]}
      className="fixed inset-0 z-[120] flex flex-col bg-black pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-2">
        <p className="truncate text-sm font-semibold text-white">{COPY.title[uiLang]}</p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/95 text-2xl leading-none text-slate-900 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label={COPY.close[uiLang]}
        >
          ×
        </button>
      </div>
      <div className="relative min-h-0 min-w-[325px] flex-1 bg-black">
        {iframeSrc ? (
          <iframe
            ref={assignIframeRef}
            src={iframeSrc}
            title={COPY.title[uiLang]}
            className="absolute inset-0 h-full w-full border-0 bg-black"
            allow={TIKTOK_IFRAME_ALLOW}
            sandbox={isEmbed ? tikTokEmbedIframeSandbox() : undefined}
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => {
              if (isPlayer) onIframeLoad();
            }}
            onError={() => {
              if (isPlayer && resolvedId && !fallbackUsedRef.current) {
                fallbackUsedRef.current = true;
                setIframeSrc(buildTikTokEmbedUrl(resolvedId));
              }
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
            {resolveError ? (
              <p className="px-6 text-center text-sm font-medium">{COPY.error[uiLang]}</p>
            ) : (
              <>
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent" />
                <p className="text-xs font-medium">
                  {COPY.loading[uiLang]} TikTok…
                </p>
              </>
            )}
          </div>
        )}
        {showSoundPrompt && isPlayer ? (
          <TikTokSoundPromptButton
            label={TIKTOK_SOUND_COPY[uiLang]}
            onClick={onTapForSound}
          />
        ) : null}
      </div>
    </div>,
    document.body
  );
}
