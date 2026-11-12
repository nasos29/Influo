/**
 * Pure helpers for Admin TikTok integration UI (safe for Node unit tests).
 */

/** Abbreviate UUID for admin diagnostics (never a secret). */
export function abbreviateInfluencerId(id: string | null | undefined): string {
  if (!id) return "—";
  const t = id.trim();
  if (t.length <= 12) return t;
  return `${t.slice(0, 8)}…${t.slice(-4)}`;
}

export function abbreviateOpenId(openId: string | null | undefined): string {
  if (!openId) return "—";
  const t = openId.trim();
  if (t.length <= 16) return t;
  return `${t.slice(0, 10)}…${t.slice(-4)}`;
}

/** Reject rendering if a payload accidentally includes token-like material. */
export function assertSafeAdminDisplay(text: string): string {
  if (/\b(act\.|rft\.|access_token|refresh_token|client_secret)\b/i.test(text)) {
    return "[redacted]";
  }
  return text;
}

/** Connect redirect must land on official TikTok authorize host. */
export function isSafeTikTokAuthorizeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "www.tiktok.com";
  } catch {
    return false;
  }
}
