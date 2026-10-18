const LOGOUT_MARK_MS = 2 * 60 * 1000;

/** True when a storage key holds a Supabase auth session. */
export function isSupabaseAuthKey(key: string): boolean {
  return /^sb-/i.test(key) || /supabase/i.test(key) || /auth-token/i.test(key);
}

/** A logout stamp blocks a cached session only for a short window. */
export function loggedOutStampActive(raw: string | null, now = Date.now()): boolean {
  if (!raw) return false;
  const at = Number(raw);
  return Number.isFinite(at) && now - at >= 0 && now - at < LOGOUT_MARK_MS;
}
