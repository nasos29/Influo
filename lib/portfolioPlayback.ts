/**
 * Coordinate portfolio embeds: when one starts playing, others pause.
 * Uses a window CustomEvent so SocialEmbedCard / VideoThumbnail stay decoupled.
 */

export const PORTFOLIO_PLAYBACK_EVENT = "influo:portfolio-playback";

export type PortfolioPlaybackDetail = {
  /** Unique id for the card that claimed playback (or null = pause all). */
  id: string | null;
};

export function claimPortfolioPlayback(id: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PortfolioPlaybackDetail>(PORTFOLIO_PLAYBACK_EVENT, {
      detail: { id },
    })
  );
}

export function pauseAllPortfolioPlayback(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PortfolioPlaybackDetail>(PORTFOLIO_PLAYBACK_EVENT, {
      detail: { id: null },
    })
  );
}

/** postMessage helpers for YouTube iframe API (requires enablejsapi=1). */
export function postYouTubeCommand(
  iframe: HTMLIFrameElement | null | undefined,
  func: "playVideo" | "pauseVideo" | "mute" | "unMute"
): void {
  const win = iframe?.contentWindow;
  if (!win) return;
  win.postMessage(
    JSON.stringify({ event: "command", func, args: [] }),
    "https://www.youtube.com"
  );
}
