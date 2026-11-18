/**
 * Only one official TikTok player/v1 iframe should be mounted at a time.
 * Each iframe loads TikTok's player SDK (and msToken / webmssdk). Several
 * at once on Chrome mobile tend to trip per-domain usage limits
 * (onPlayerError 2005 TOO_MANY_REQUESTS) or leave the in-iframe
 * "Player error" state.
 *
 * Cards still start as a cover + tap-to-load facade; claiming this session
 * unloads every other TikTok iframe back to that facade.
 */

export const TIKTOK_PLAYER_SESSION_EVENT = "influo:tiktok-player-session";

export type TikTokPlayerSessionDetail = {
  /** Unique id for the card that may keep its iframe (or null = unload all). */
  id: string | null;
};

export function claimTikTokPlayerSession(id: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<TikTokPlayerSessionDetail>(TIKTOK_PLAYER_SESSION_EVENT, {
      detail: { id },
    })
  );
}

export function releaseAllTikTokPlayerSessions(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<TikTokPlayerSessionDetail>(TIKTOK_PLAYER_SESSION_EVENT, {
      detail: { id: null },
    })
  );
}
