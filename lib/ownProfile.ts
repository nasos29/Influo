import type { SupabaseClient } from "@supabase/supabase-js";

export {
  BRAND_BROWSER_COLUMNS,
  BRAND_OWNER_COLUMNS,
  INFLUENCER_BROWSER_COLUMNS,
  INFLUENCER_OWNER_COLUMNS,
} from "@/lib/profileColumns";

const READ_ERROR = "Δεν ήταν δυνατή η ανάγνωση του προφίλ. Δοκιμάστε ξανά.";

export type OwnProfiles =
  | {
      ok: true;
      influencer: Record<string, unknown> | null;
      brand: Record<string, unknown> | null;
    }
  | { ok: false; reason: "error"; message: string };

export type OwnLoadResult<T> =
  | { ok: true; profile: T }
  | { ok: false; reason: "missing" }
  | { ok: false; reason: "error"; message: string };

/**
 * Own influencer and brand rows for the current session.
 * The browser does not select * or filter contact_email on those tables.
 */
export async function loadOwnProfiles(supabase: SupabaseClient): Promise<OwnProfiles> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, reason: "error", message: "Δεν υπάρχει ενεργή σύνδεση." };
  }

  let response: Response;
  try {
    response = await fetch("/api/me/profile", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "error", message: READ_ERROR };
  }

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    influencer?: Record<string, unknown> | null;
    brand?: Record<string, unknown> | null;
  };
  if (!response.ok) {
    return {
      ok: false,
      reason: "error",
      message: typeof body.error === "string" && body.error ? body.error : READ_ERROR,
    };
  }

  return {
    ok: true,
    influencer: body.influencer ?? null,
    brand: body.brand ?? null,
  };
}

export async function loadOwnInfluencer(
  supabase: SupabaseClient
): Promise<OwnLoadResult<Record<string, unknown>>> {
  const profiles = await loadOwnProfiles(supabase);
  if (!profiles.ok) return profiles;
  if (!profiles.influencer) return { ok: false, reason: "missing" };
  return { ok: true, profile: profiles.influencer };
}

export async function loadOwnBrand(
  supabase: SupabaseClient
): Promise<OwnLoadResult<Record<string, unknown>>> {
  const profiles = await loadOwnProfiles(supabase);
  if (!profiles.ok) return profiles;
  if (!profiles.brand) return { ok: false, reason: "missing" };
  return { ok: true, profile: profiles.brand };
}

/** True when a brand account exists. Does not return the email address. */
export async function brandHasAccount(supabase: SupabaseClient, email: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return false;
  const rpc = await supabase.rpc("brand_account_exists", { p_email: normalized });
  if (rpc.error || typeof rpc.data !== "boolean") return false;
  return rpc.data;
}
