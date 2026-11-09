const LOGOUT_MARK_MS = 2 * 60 * 1000;
const LOGOUT_FLAG = "influo-logged-out";

/** True when a storage key holds a Supabase auth session. */
export function isSupabaseAuthKey(key: string): boolean {
  return /^sb-/i.test(key) || /supabase/i.test(key) || /auth-token/i.test(key);
}

/**
 * Sync hint that a Supabase session may exist (localStorage and/or sb-* cookies).
 * Used to show a header placeholder only when auth is likely — guests stay as «Σύνδεση».
 */
export function hasLikelySupabaseAuthSession(): boolean {
  if (typeof localStorage !== "undefined") {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key !== LOGOUT_FLAG && isSupabaseAuthKey(key)) return true;
      }
    } catch {
      /* private mode / blocked storage */
    }
  }
  if (typeof document !== "undefined") {
    try {
      if (/(?:^|;\s*)sb-[^=]+=/.test(document.cookie || "")) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

/** A logout stamp blocks a cached session only for a short window. */
export function loggedOutStampActive(raw: string | null, now = Date.now()): boolean {
  if (!raw) return false;
  const at = Number(raw);
  return Number.isFinite(at) && now - at >= 0 && now - at < LOGOUT_MARK_MS;
}
