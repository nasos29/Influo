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

/** No player error is auto-retried — TikTok per-domain limits make retries harmful. */
export function isRetryableTikTokPlayerError(_code: number | null): boolean {
  return false;
}

/**
 * Tear the iframe down only for rate-limit / server refusals. Playback and
 * SDK errors should fall back to embed/v2 instead of returning to the cover.
 */
export function shouldUnloadTikTokPlayer(value: unknown, _alreadyRetried = false): boolean {
  if (isFatalTikTokPlayerError(value)) return false;
  return isTikTokPlayerOverloadError(value);
}

export function isTikTokPlayerSdkOrPlaybackError(value: unknown): boolean {
  const typ = tikTokPlayerErrorType(value);
  if (typ === "PLAYBACK_ERROR" || typ === "PLAYER_SDK_ERROR") return true;
  const code = tikTokPlayerErrorCode(value);
  return (
    code === TIKTOK_PLAYER_ERROR.PLAYBACK_ERROR ||
    code === TIKTOK_PLAYER_ERROR.PLAYER_SDK_ERROR
  );
}

/**
 * Switch from player/v1 to embed/v2 after any non-fatal player failure,
 * including 2005/2001 rate-limits. Autoplay blocks (3002) stay on player/v1
 * muted with a play/sound prompt — never treated as a load error. 3001
 * switches to embed/v2 immediately (no play() retry).
 */
export function shouldFallbackToTikTokEmbed(value: unknown, _alreadyRetried = false): boolean {
  if (isFatalTikTokPlayerError(value)) return false;
  const code = tikTokPlayerErrorCode(value);
  if (code === TIKTOK_PLAYER_ERROR.AUTOPLAY_ERROR) return false;
  if (code === TIKTOK_PLAYER_ERROR.PLAYBACK_ERROR) return true;
  if (isTikTokPlayerOverloadError(value)) return true;
  if (code === TIKTOK_PLAYER_ERROR.PLAYER_SDK_ERROR) return true;
  return code != null;
}

export function logTikTokPlayerMessage(type: string, value?: unknown): void {
  try {
    console.info("[influo:tiktok]", type, value ?? "");
  } catch {
    /* ignore */
  }
}
