import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { beginPresenceLogout } from "@/lib/presenceControl";

const LOGOUT_FLAG = "influo-logged-out";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return withTimeoutFlag(promise, ms).then((result) => result.value);
}

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
  const fromUser = await withTimeoutFlag(
    supabase.auth.getUser().then((result) => result.data.user ?? null),
    timeoutMs
  );
  if (fromUser.value) return { user: fromUser.value, timedOut: false };
  const fromSession = await withTimeoutFlag(
    supabase.auth.getSession().then((result) => result.data.session?.user ?? null),
    2500
  );
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
      if (/^sb-/i.test(key) || /supabase/i.test(key) || /auth-token/i.test(key)) {
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
      if (name.startsWith("sb-") || /supabase/i.test(name)) {
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      }
    });
  } catch {
    /* ignore */
  }
}

export function markLoggedOut(): void {
  try {
    sessionStorage.setItem(LOGOUT_FLAG, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function consumeLoggedOutFlag(): boolean {
  try {
    const raw = sessionStorage.getItem(LOGOUT_FLAG);
    if (!raw) return false;
    sessionStorage.removeItem(LOGOUT_FLAG);
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < 60_000;
  } catch {
    return false;
  }
}

/**
 * Ends the Supabase session for brands, influencers and admins.
 * Local storage is cleared even if the network revoke is slow, then the browser
 * navigates with a full reload so a refresh cannot write the session back.
 */
export async function logoutEverywhere(redirectTo = "/login"): Promise<void> {
  beginPresenceLogout();
  markLoggedOut();
  try {
    await withTimeout(supabase.auth.signOut({ scope: "local" }), 1500);
  } catch {
    /* ignore */
  }
  clearSupabaseAuthStorage();
  void supabase.auth.signOut({ scope: "global" }).catch(() => undefined);
  if (typeof window !== "undefined") {
    window.location.replace(redirectTo);
  }
}
