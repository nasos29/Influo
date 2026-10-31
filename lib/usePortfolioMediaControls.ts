"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { postTikTokPlayer } from "@/lib/tikTokPlayer";
import {
  claimPortfolioPlayback,
  PORTFOLIO_PLAYBACK_EVENT,
  postYouTubeCommand,
  type PortfolioPlaybackDetail,
} from "@/lib/portfolioPlayback";

export type PortfolioMediaKind = "tiktok" | "youtube" | "native";

/**
 * Second click pauses, third resumes. Starting this media pauses other portfolio players.
 */
export function usePortfolioMediaControls(
  kind: PortfolioMediaKind | null,
  active: boolean
) {
  const reactId = useId();
  const idRef = useRef(`portfolio-media-${reactId}`);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const pauseSelf = useCallback(() => {
    if (kind === "tiktok") postTikTokPlayer(iframeRef.current, "pause");
    else if (kind === "youtube") postYouTubeCommand(iframeRef.current, "pauseVideo");
    else if (kind === "native") {
      try {
        videoRef.current?.pause();
      } catch {
        /* ignore */
      }
    }
    setPlaying(false);
  }, [kind]);

  const playSelf = useCallback(() => {
    claimPortfolioPlayback(idRef.current);
    if (kind === "tiktok") postTikTokPlayer(iframeRef.current, "play");
    else if (kind === "youtube") postYouTubeCommand(iframeRef.current, "playVideo");
    else if (kind === "native") {
      void videoRef.current?.play()?.catch(() => {
        /* autoplay may fail */
      });
    }
    setPlaying(true);
  }, [kind]);

  const toggle = useCallback(() => {
    if (!active || !kind) return;
    if (playing) pauseSelf();
    else playSelf();
  }, [active, kind, pauseSelf, playSelf, playing]);

  // When this media first becomes active (autoplay), claim + mark playing.
  useEffect(() => {
    if (!active || !kind) {
      setPlaying(false);
      return;
    }
    claimPortfolioPlayback(idRef.current);
    setPlaying(true);
  }, [active, kind]);

  // Pause when another portfolio card claims playback.
  useEffect(() => {
    if (!active) return;
    const onClaim = (event: Event) => {
      const detail = (event as CustomEvent<PortfolioPlaybackDetail>).detail;
      if (!detail || detail.id === idRef.current) return;
      pauseSelf();
    };
    window.addEventListener(PORTFOLIO_PLAYBACK_EVENT, onClaim);
    return () => window.removeEventListener(PORTFOLIO_PLAYBACK_EVENT, onClaim);
  }, [active, pauseSelf]);

  return {
    iframeRef,
    videoRef,
    playing,
    toggle,
    playSelf,
    pauseSelf,
  };
}
