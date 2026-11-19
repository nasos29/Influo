"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TikTokSoundPromptButton from "@/components/TikTokSoundPromptButton";
import { TIKTOK_SOUND_COPY } from "@/lib/useTikTokPlayerHost";
import { usePortfolioMediaControls } from "@/lib/usePortfolioMediaControls";
import type { HostedMedia } from "@/lib/creatorMedia";

const COPY = {
  play: { el: "Αναπαραγωγή", en: "Play" },
  pause: { el: "Παύση", en: "Pause" },
  resume: { el: "Συνέχεια", en: "Resume" },
} as const;

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

/**
 * In-card player for Influo-hosted videos. Play/pause + sound only — no
 * browser chrome, no off-site links, no DRM. Fills the card and pauses peers.
 */
export default function HostedVideoPlayer({
  media,
  lang = "el",
  posterFallback,
  onError,
}: {
  media: HostedMedia;
  lang?: "el" | "en";
  posterFallback?: string | null;
  onError?: () => void;
}) {
  const uiLang = lang === "en" ? "en" : "el";
  const [muted, setMuted] = useState(false);
  const [showSound, setShowSound] = useState(false);
  const startedRef = useRef(false);
  const [playUrl, setPlayUrl] = useState(() => pickHostedPlaybackUrl(media));

  const {
    videoRef: mediaVideoRef,
    playing,
    toggle,
  } = usePortfolioMediaControls("native", true);

  useEffect(() => {
    setPlayUrl(pickHostedPlaybackUrl(media));
    startedRef.current = false;
  }, [media]);

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
    el.muted = false;
    setMuted(false);
    setShowSound(false);
    void el.play()?.catch(() => {
      el.muted = true;
      setMuted(true);
      setShowSound(true);
    });
  }, [mediaVideoRef]);

  useEffect(() => {
    const el = mediaVideoRef.current;
    if (!el || startedRef.current) return;
    startedRef.current = true;
    tryUnmutedPlay(el);
  }, [mediaVideoRef, tryUnmutedPlay]);

  return (
    <>
      <video
        src={playUrl}
        poster={media.posterUrl || posterFallback || undefined}
        playsInline
        autoPlay
        preload="metadata"
        controls={false}
        muted={muted}
        className="absolute inset-0 z-[5] h-full w-full bg-black object-cover"
        ref={(el) => {
          mediaVideoRef.current = el;
        }}
        data-hosted-player="true"
        data-source-kind={sourceKind(media, playUrl)}
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
      />
      <button
        type="button"
        className="absolute inset-0 z-[15] bg-transparent"
        aria-label={playing ? COPY.pause[uiLang] : COPY.resume[uiLang]}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (showSound) {
            onTapForSound();
            return;
          }
          toggle();
        }}
      />
      {showSound ? (
        <TikTokSoundPromptButton label={TIKTOK_SOUND_COPY[uiLang]} onClick={onTapForSound} />
      ) : null}
    </>
  );
}
