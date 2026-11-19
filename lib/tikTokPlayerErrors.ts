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
 * The official player cannot load this item (invalid or banned).
 * Only 1001 INVALID_VIDEO may trigger a portfolio swap, and only after
 * TikTok oEmbed confirms the item is gone. 1002/1005 stay on the cover
 * with Retry and must never hide or replace the post.
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

/** 1001 INVALID_VIDEO only — the sole player error that may lead to a swap. */
export function isInvalidTikTokVideoError(value: unknown): boolean {
  if (tikTokPlayerErrorType(value) === "INVALID_VIDEO") return true;
  return tikTokPlayerErrorCode(value) === TIKTOK_PLAYER_ERROR.INVALID_VIDEO;
}

/**
 * @deprecated Immediate embed/v2 fallback is used instead. Kept empty so
 * existing callers of nextTikTokSilentRetryDelay skip remounts.
 */
export const TIKTOK_LIMIT_RETRY_BACKOFF_MS = [] as const;

/** Always null: do not remount player/v1 after 3001/1004/2005; fall back now. */
export function nextTikTokSilentRetryDelay(_attempt: number): number | null {
  return null;
}

/** If player/v1 never sends onPlayerReady, silently fall back to embed/v2. */
export const TIKTOK_PLAYER_READY_TIMEOUT_MS = 8000;

/**
 * Rate-limit / server refusal (2005/2001). Fall back to embed/v2 immediately.
 * Do not remount player/v1, and do not swap or hide the post.
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
 * Switch to embed/v2 immediately. True for 3001 / 1004 / 2005 / 2001 and
 * any other non-fatal, non-3002 error. Autoplay blocks (3002) stay on
 * player/v1 muted.
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
