export type YoutubeAccountLike = {
  username?: string | null;
  channel_handle?: string | null;
  channel_id?: string | null;
};

function ensureHttps(url: string): string {
  const s = String(url || "").trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function stripAt(value: string): string {
  return String(value || "").trim().replace(/^@+/, "");
}

/** UC… channel ids from the YouTube Data API. */
export function isYouTubeChannelId(value: string): boolean {
  return /^UC[\w-]{20,}$/.test(String(value || "").trim());
}

/**
 * Pull handle or channel id from a youtube.com / youtu.be URL.
 * Returns null when the URL is not a channel URL.
 */
export function parseYouTubeChannelFromUrl(
  raw: string
): { handle?: string; channelId?: string } | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    const u = new URL(ensureHttps(text));
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "youtu.be") {
      return null;
    }
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0]?.startsWith("@")) {
      const handle = stripAt(parts[0]);
      return handle ? { handle } : null;
    }
    if (parts[0] === "channel" && parts[1]) {
      return { channelId: parts[1] };
    }
    if (parts[0] === "c" && parts[1]) {
      return { handle: stripAt(parts[1]) };
    }
    if (parts[0] === "user" && parts[1]) {
      return { handle: stripAt(parts[1]) };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Public channel URL, preferred order:
 * 1) channel_id → /channel/<id> (stable; handles can redirect to stale 404 URLs)
 * 2) channel_handle → /@handle
 * 3) username (add @ if needed; parse full URLs / UC ids)
 */
export function youtubeChannelUrl(
  account: YoutubeAccountLike | null | undefined
): string | null {
  if (!account) return null;

  const fromId = String(account.channel_id || "").trim();
  if (fromId) return `https://www.youtube.com/channel/${fromId}`;

  const fromHandle = stripAt(String(account.channel_handle || ""));
  if (fromHandle) return `https://www.youtube.com/@${fromHandle}`;

  const username = String(account.username || "").trim();
  if (!username) return null;

  if (
    /^https?:\/\//i.test(username) ||
    /youtube\.com|youtu\.be/i.test(username)
  ) {
    const parsed = parseYouTubeChannelFromUrl(username);
    if (parsed?.handle) return `https://www.youtube.com/@${parsed.handle}`;
    if (parsed?.channelId) return `https://www.youtube.com/channel/${parsed.channelId}`;
    return ensureHttps(username);
  }

  if (/\s/.test(username)) return null;

  const bare = stripAt(username);
  if (!bare) return null;
  if (isYouTubeChannelId(bare)) return `https://www.youtube.com/channel/${bare}`;
  return `https://www.youtube.com/@${bare}`;
}

/**
 * Normalize a YouTube username for storage: trim, no spaces → ensure leading @
 * (UC channel ids stay as-is; full channel URLs become @handle or stay as id).
 */
export function normalizeYouTubeUsernameForSave(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (/\s/.test(trimmed)) return trimmed;

  if (
    /^https?:\/\//i.test(trimmed) ||
    /youtube\.com|youtu\.be/i.test(trimmed)
  ) {
    const parsed = parseYouTubeChannelFromUrl(trimmed);
    if (parsed?.handle) return `@${parsed.handle}`;
    if (parsed?.channelId) return parsed.channelId;
  }

  const bare = stripAt(trimmed);
  if (!bare) return "";
  if (isYouTubeChannelId(bare)) return bare;
  return `@${bare}`;
}

/** Username for Auditpr / YouTube API calls (no leading @). */
export function youtubeUsernameForAuditpr(raw: string): string {
  return stripAt(String(raw || ""));
}
