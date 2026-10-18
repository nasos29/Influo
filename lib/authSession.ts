import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { beginPresenceLogout } from "@/lib/presenceControl";
import { isSupabaseAuthKey, loggedOutStampActive } from "@/lib/authStorage";

const LOGOUT_FLAG = "influo-logged-out";

function withTimeoutFlag<T>(promise: Promise<T>, ms: number): Promise<{ value: T | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ value: null, timedOut: true });
    }, ms);
    promise
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ value, timedOut: false });
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ value: null, timedOut: false });
      });
  });
}

export type AuthLookup = { user: User | null; timedOut: boolean };

/**
 * getUser that cannot hang the dashboard forever.
 * timedOut is true only when both lookups failed to answer — a completed
 * empty result means the visitor is logged out.
 */
export async function lookupAuthUser(timeoutMs = 8000): Promise<AuthLookup> {
  if (isLoggedOutMarked()) {
    clearSupabaseAuthStorage();
    return { user: null, timedOut: false };
  }
  const fromUser = await withTimeoutFlag(
    supabase.auth.getUser().then((result) => ({
      user: result.data.user ?? null,
      failed: !!result.error,
    })),
    timeoutMs
  );
  if (fromUser.value?.user) return { user: fromUser.value.user, timedOut: false };
  // A finished getUser with no user and no error means logged out.
  // A timeout or transport error may still have a cached session.
  if (fromUser.value && !fromUser.value.failed) return { user: null, timedOut: false };
  const fromSession = await withTimeoutFlag(
    supabase.auth.getSession().then((result) => result.data.session?.user ?? null),
    2500
  );
  if (isLoggedOutMarked()) return { user: null, timedOut: false };
  if (fromSession.value) return { user: fromSession.value, timedOut: false };
  return { user: null, timedOut: fromUser.timedOut || fromSession.timedOut };
}

/** getUser that cannot hang the dashboard forever. Falls back to the cached session. */
export async function getAuthUser(timeoutMs = 8000): Promise<User | null> {
  const result = await lookupAuthUser(timeoutMs);
  return result.user;
}

export function clearSupabaseAuthStorage(): void {
  if (typeof window === "undefined") return;
  const wipe = (store: Storage) => {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key) keys.push(key);
    }
    for (const key of keys) {
      if (isSupabaseAuthKey(key) && key !== LOGOUT_FLAG) {
        store.removeItem(key);
      }
    }
  };
  try {
    wipe(window.localStorage);
  } catch {
    /* ignore */
  }
  try {
    wipe(window.sessionStorage);
  } catch {
    /* ignore */
  }
  try {
    document.cookie.split(";").forEach((part) => {
      const name = part.split("=")[0]?.trim();
      if (!name) return;
      if ((name.startsWith("sb-") || /supabase/i.test(name)) && name !== LOGOUT_FLAG) {
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      }
    });
  } catch {
    /* ignore */
  }
}

function stampFrom(store: Storage): string | null {
  try {
    return store.getItem(LOGOUT_FLAG);
  } catch {
    return null;
  }
}

export function markLoggedOut(): void {
  const stamp = String(Date.now());
  try {
    localStorage.setItem(LOGOUT_FLAG, stamp);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(LOGOUT_FLAG, stamp);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${LOGOUT_FLAG}=${stamp}; Path=/; Max-Age=120; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function isLoggedOutMarked(): boolean {
  if (typeof window === "undefined") return false;
  const now = Date.now();
  const stamps = [stampFrom(localStorage), stampFrom(sessionStorage)];
  try {
    const cookie = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${LOGOUT_FLAG}=`));
    if (cookie) stamps.push(decodeURIComponent(cookie.slice(LOGOUT_FLAG.length + 1)));
  } catch {
    /* ignore */
  }
  const active = stamps.some((raw) => loggedOutStampActive(raw, now));
  if (!active && stamps.some(Boolean)) clearLoggedOutMark();
  return active;
}

export function clearLoggedOutMark(): void {
  try {
    localStorage.removeItem(LOGOUT_FLAG);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(LOGOUT_FLAG);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${LOGOUT_FLAG}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

function storedAccessToken(): string {
  if (typeof window === "undefined") return "";
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !isSupabaseAuthKey(key)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { access_token?: unknown };
      if (typeof parsed?.access_token === "string" && parsed.access_token) return parsed.access_token;
    }
  } catch {
    /* ignore */
  }
  return "";
}

/**
 * Ends the Supabase session for brands, influencers and admins.
 * Local storage is cleared even if the network revoke is slow, then the browser
 * navigates with a full reload so a refresh cannot write the session back.
 */
/**
 * Clears the session before any await, then leaves the page with a full load.
 * Waiting on signOut lets an in-flight refresh write the session back.
 */
export function logoutEverywhere(redirectTo = "/login"): void {
  beginPresenceLogout();
  const token = storedAccessToken();
  markLoggedOut();
  try {
    supabase.auth.stopAutoRefresh();
  } catch {
    /* ignore */
  }
  clearSupabaseAuthStorage();
  void fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: token
      ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" },
  }).catch(() => undefined);
  void supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  if (typeof window !== "undefined") {
    window.location.replace(redirectTo);
  }
}
