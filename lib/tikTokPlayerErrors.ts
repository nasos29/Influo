/**
 * Official TikTok embed-player onPlayerError codes, plus extras found in the
 * player/v1 bundle (not all are listed in the public docs).
 *
 * @see https://developers.tiktok.com/docs/en/embed-player
 */
export const TIKTOK_PLAYER_ERROR = {
  INVALID_VIDEO: 1001,
  VIDEO_EMBED_BANNED: 1002,
  PLAYER_SDK_ERROR: 1004,
  EMBED_BANNED_ALT: 1005,
  SERVER_ERROR: 2001,
  TOO_MANY_REQUESTS: 2005,
  PLAYBACK_ERROR: 3001,
  AUTOPLAY_ERROR: 3002,
} as const;

export function tikTokPlayerErrorCode(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    const rec = value as { code?: unknown; errorCode?: unknown };
    const code = rec.errorCode ?? rec.code;
    if (typeof code === "number") return code;
  }
  return null;
}

export function tikTokPlayerErrorType(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  return String((value as { errorType?: unknown }).errorType || "").toUpperCase();
}

/**
 * The official player cannot load this item (invalid or banned). Retry and
 * re-loading will not help; the card may hide or swap in another post.
 */
export function isFatalTikTokPlayerError(value: unknown): boolean {
  const typ = tikTokPlayerErrorType(value);
  if (
    typ === "INVALID_VIDEO" ||
    typ === "VIDEO_EMBED_BANNED" ||
    typ === "EMBED_BANNED"
  ) {
    return true;
  }
  const code = tikTokPlayerErrorCode(value);
  return (
    code === TIKTOK_PLAYER_ERROR.INVALID_VIDEO ||
    code === TIKTOK_PLAYER_ERROR.VIDEO_EMBED_BANNED ||
    code === TIKTOK_PLAYER_ERROR.EMBED_BANNED_ALT
  );
}

/**
 * Rate-limit / server refusal. Retrying or loading a replacement iframe
 * makes this worse. Unload the player back to the facade instead.
 */
export function isTikTokPlayerOverloadError(value: unknown): boolean {
  const typ = tikTokPlayerErrorType(value);
  if (typ === "TOO_MANY_REQUESTS" || typ === "RATE_LIMITED" || typ === "SERVER_ERROR") {
    return true;
  }
  const code = tikTokPlayerErrorCode(value);
  return (
    code === TIKTOK_PLAYER_ERROR.TOO_MANY_REQUESTS ||
    code === TIKTOK_PLAYER_ERROR.SERVER_ERROR
  );
}

/** Only 3001 is worth a single delayed play() retry (CDN / init race). */
export function isRetryableTikTokPlayerError(code: number | null): boolean {
  return code === TIKTOK_PLAYER_ERROR.PLAYBACK_ERROR;
}

/**
 * After a non-fatal error, tear down the iframe so TikTok's "Player error"
 * UI is not left on screen, and so we stop talking to their player.
 * Autoplay blocks (3002) stay mounted — the user can tap for sound.
 */
export function shouldUnloadTikTokPlayer(value: unknown, alreadyRetried: boolean): boolean {
  if (isFatalTikTokPlayerError(value)) return false;
  if (isTikTokPlayerOverloadError(value)) return true;
  const code = tikTokPlayerErrorCode(value);
  if (code === TIKTOK_PLAYER_ERROR.AUTOPLAY_ERROR) return false;
  if (code === TIKTOK_PLAYER_ERROR.PLAYBACK_ERROR) return alreadyRetried;
  // 1004 player_sdk_error and any other unknown code: unload, do not retry-storm.
  return code != null;
}
