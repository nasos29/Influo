/**
 * Coordinate TikTok player/v1 iframes across cards.
 *
 * Cards still start as a cover + tap-to-load facade. Claiming a session
 * (only from an explicit user start) tells other cards to pause — not to
 * unload immediately. Mobile may later unload an other card that is
 * off-screen or has stayed paused for a long time (2005 TOO_MANY_REQUESTS
 * protection); visible paused cards stay mounted.
 */

export const TIKTOK_PLAYER_SESSION_EVENT = "influo:tiktok-player-session";

/** How long a yielded (paused-for-other) mobile card may stay mounted. */
export const TIKTOK_YIELDED_UNLOAD_MS = 60_000;

export type TikTokPlayerSessionDetail = {
  /** Unique id for the card that may keep playing (or null = pause all). */
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
