import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeProfileSlug, PROFILE_SLUG_RESERVED, slugifyProfileName } from "@/lib/profileSlug";

const HISTORY = "influencer_slug_history";

type DbError = { message?: string; code?: string } | null;

export function missingSlugHistoryTable(error: DbError): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = error.message || "";
  return /influencer_slug_history/i.test(msg) && /does not exist|schema cache|could not find/i.test(msg);
}

type Owner = { id: string; where: "current" | "history" };

async function findSlugOwner(admin: SupabaseClient, slug: string): Promise<Owner | "missing-history" | null> {
  const current = await admin.from("influencers").select("id").eq("profile_slug", slug).maybeSingle();
  if (current.error) throw new Error(current.error.message);
  if (current.data?.id) return { id: String(current.data.id), where: "current" };

  const history = await admin.from(HISTORY).select("influencer_id").eq("slug", slug).maybeSingle();
  if (history.error) {
    if (missingSlugHistoryTable(history.error)) return "missing-history";
    throw new Error(history.error.message);
  }
  if (history.data?.influencer_id) return { id: String(history.data.influencer_id), where: "history" };
  return null;
}

/** Pick a free slug. Does not write. History collisions are skipped when that table exists. */
export async function allocateUniqueSlug(
  admin: SupabaseClient,
  base: string,
  influencerId: string
): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 30; i++) {
    if (PROFILE_SLUG_RESERVED.has(candidate)) {
      candidate = nextCandidate(base, i);
      continue;
    }
    const owner = await findSlugOwner(admin, candidate);
    if (owner === "missing-history" || owner === null || owner.id === influencerId) return candidate;
    candidate = nextCandidate(base, i);
  }
  const tail = String(influencerId).replace(/-/g, "").slice(0, 8);
  return `creator-${tail || "profile"}`;
}

function nextCandidate(base: string, index: number): string {
  const suffix = `-${index + 2}`;
  return `${base.slice(0, Math.max(1, 40 - suffix.length))}${suffix}`;
}

/**
 * Give an influencer a slug only when they do not have one.
 * Never overwrites a backfilled or chosen slug.
 */
export async function ensureProfileSlug(admin: SupabaseClient, influencerId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("influencers")
    .select("id, display_name, profile_slug")
    .eq("id", influencerId)
    .maybeSingle();
  if (error || !data?.id) return null;
  const existing = typeof data.profile_slug === "string" ? data.profile_slug.trim() : "";
  if (existing) return existing;

  const displayName = typeof data.display_name === "string" ? data.display_name : "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = await allocateUniqueSlug(admin, slugifyProfileName(displayName, influencerId), influencerId);
    const updated = await admin
      .from("influencers")
      .update({ profile_slug: slug })
      .eq("id", influencerId)
      .is("profile_slug", null)
      .select("profile_slug")
      .maybeSingle();
    if (!updated.error && updated.data?.profile_slug) return String(updated.data.profile_slug);

    const again = await admin.from("influencers").select("profile_slug").eq("id", influencerId).maybeSingle();
    const kept = typeof again.data?.profile_slug === "string" ? again.data.profile_slug.trim() : "";
    if (kept) return kept;
    if (updated.error && updated.error.code !== "23505") return null;
  }
  return null;
}

export type SlugChangeResult =
  | { ok: true; slug: string }
  | { ok: false; status: number; error: string };

/**
 * Replace the public slug. The previous slug is kept so /in/<old> can 308 to the new one.
 * If the history table is not installed yet, a real change is refused so the old URL is not orphaned.
 */
export async function changeProfileSlug(
  admin: SupabaseClient,
  influencerId: string,
  currentSlug: string | null | undefined,
  wantedRaw: string
): Promise<SlugChangeResult> {
  const wanted = normalizeProfileSlug(wantedRaw);
  if (!wanted) {
    return {
      ok: false,
      status: 400,
      error: "Μη έγκυρο slug. Χρησιμοποίησε λατινικά γράμματα, αριθμούς και παύλα.",
    };
  }
  const current = (currentSlug || "").trim().toLowerCase();
  if (current === wanted) return { ok: true, slug: wanted };

  const owner = await findSlugOwner(admin, wanted);
  if (owner !== "missing-history" && owner && owner.id !== influencerId) {
    return { ok: false, status: 409, error: "Αυτό το link χρησιμοποιείται ήδη. Δοκίμασε άλλο." };
  }

  if (current) {
    const remembered = await rememberSlug(admin, current, influencerId);
    if (remembered === "missing") {
      return {
        ok: false,
        status: 503,
        error: "Η αλλαγή link δεν έγινε. Πρέπει πρώτα να τρέξει το docs/PROFILE_SLUG_HISTORY.sql, ώστε το παλιό URL να μην σπάσει.",
      };
    }
    if (remembered === "conflict") {
      return { ok: false, status: 409, error: "Αυτό το link χρησιμοποιείται ήδη. Δοκίμασε άλλο." };
    }
  }

  const { error } = await admin.from("influencers").update({ profile_slug: wanted }).eq("id", influencerId);
  if (error) {
    if (error.code === "23505") {
      return { ok: false, status: 409, error: "Αυτό το link χρησιμοποιείται ήδη. Δοκίμασε άλλο." };
    }
    return { ok: false, status: 500, error: error.message };
  }

  if (owner && owner !== "missing-history" && owner.id === influencerId && owner.where === "history") {
    await admin.from(HISTORY).delete().eq("slug", wanted).eq("influencer_id", influencerId);
  }
  return { ok: true, slug: wanted };
}

async function rememberSlug(
  admin: SupabaseClient,
  slug: string,
  influencerId: string
): Promise<"ok" | "missing" | "conflict"> {
  const existing = await admin.from(HISTORY).select("influencer_id").eq("slug", slug).maybeSingle();
  if (existing.error) {
    if (missingSlugHistoryTable(existing.error)) return "missing";
    throw new Error(existing.error.message);
  }
  if (existing.data?.influencer_id && String(existing.data.influencer_id) !== influencerId) return "conflict";
  if (existing.data) return "ok";

  const inserted = await admin.from(HISTORY).insert({ slug, influencer_id: influencerId });
  if (inserted.error) {
    if (missingSlugHistoryTable(inserted.error)) return "missing";
    if (inserted.error.code === "23505") {
      const again = await admin.from(HISTORY).select("influencer_id").eq("slug", slug).maybeSingle();
      if (again.data && String(again.data.influencer_id) === influencerId) return "ok";
      return "conflict";
    }
    throw new Error(inserted.error.message);
  }
  return "ok";
}

/** Influencer id that used to publish this slug, if the history table exists. */
export async function retiredSlugInfluencerId(admin: SupabaseClient, slug: string): Promise<string | null> {
  const clean = (slug || "").trim().toLowerCase();
  if (clean.length < 2) return null;
  const history = await admin.from(HISTORY).select("influencer_id").eq("slug", clean).maybeSingle();
  if (history.error || !history.data?.influencer_id) return null;
  return String(history.data.influencer_id);
}
