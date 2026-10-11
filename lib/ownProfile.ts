import type { SupabaseClient } from "@supabase/supabase-js";

const INFLUENCER_PRIVATE_FIELDS = [
  "contact_email",
  "birth_date",
  "auth_user_id",
  "min_rate",
  "rate_card",
  "service_packages",
  "insights_urls",
] as const;

function missingRelation(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = `${error.code || ""} ${error.message || ""}`;
  return /42P01|PGRST205|PGRST202|does not exist|schema cache|Could not find the (table|function)/i.test(msg);
}

function overlayPrivate(
  profile: Record<string, unknown>,
  priv: Record<string, unknown> | null
): Record<string, unknown> {
  if (!priv) return profile;
  const merged = { ...profile };
  for (const key of INFLUENCER_PRIVATE_FIELDS) {
    if (key in priv) merged[key] = priv[key];
  }
  return merged;
}

/**
 * Public influencer row plus the caller's own private fields.
 * Other people's private columns are not readable here once SQL step 02 has run.
 */
export async function loadOwnInfluencer(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null }
): Promise<Record<string, unknown> | null> {
  const byId = await supabase.from("influencers").select("*").eq("id", user.id).maybeSingle();
  let profile = (byId.data as Record<string, unknown> | null) ?? null;

  const privQuery = await supabase.from("influencer_private").select("*").limit(1);
  let priv: Record<string, unknown> | null = null;
  if (!privQuery.error) {
    const rows = (privQuery.data || []) as Record<string, unknown>[];
    priv = rows[0] ?? null;
  }

  if (!profile && priv?.influencer_id) {
    const linked = await supabase
      .from("influencers")
      .select("*")
      .eq("id", priv.influencer_id)
      .maybeSingle();
    profile = (linked.data as Record<string, unknown> | null) ?? null;
  }

  if (!profile && user.email) {
    const legacy = await supabase
      .from("influencers")
      .select("*")
      .ilike("contact_email", user.email)
      .maybeSingle();
    if (!legacy.error && legacy.data) profile = legacy.data as Record<string, unknown>;
  }

  if (!profile) return null;
  return overlayPrivate(profile, priv);
}

/** Own brand row. contact_email comes from brand_private when the column is hidden. */
export async function loadOwnBrand(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null }
): Promise<Record<string, unknown> | null> {
  const byId = await supabase.from("brands").select("*").eq("id", user.id).maybeSingle();
  let brand = (byId.data as Record<string, unknown> | null) ?? null;

  const privQuery = await supabase.from("brand_private").select("brand_id, contact_email").limit(1);
  let privateEmail = "";
  if (!privQuery.error) {
    const row = ((privQuery.data || []) as Array<{ brand_id?: string; contact_email?: string | null }>)[0];
    privateEmail = row?.contact_email || "";
    if (!brand && row?.brand_id) {
      const linked = await supabase.from("brands").select("*").eq("id", row.brand_id).maybeSingle();
      brand = (linked.data as Record<string, unknown> | null) ?? null;
    }
  }

  if (!brand && user.email) {
    const legacy = await supabase.from("brands").select("*").ilike("contact_email", user.email).maybeSingle();
    if (!legacy.error && legacy.data) brand = legacy.data as Record<string, unknown>;
  }

  if (!brand) return null;
  const email =
    privateEmail ||
    (typeof brand.contact_email === "string" ? brand.contact_email : "") ||
    user.email ||
    "";
  return { ...brand, contact_email: email };
}

/** True when a brand account exists. Does not return the email address. */
export async function brandHasAccount(supabase: SupabaseClient, email: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return false;
  const rpc = await supabase.rpc("brand_account_exists", { p_email: normalized });
  if (!rpc.error && typeof rpc.data === "boolean") return rpc.data;
  if (!missingRelation(rpc.error)) {
    const fallback = await supabase.from("brands").select("id").eq("contact_email", normalized).maybeSingle();
    if (fallback.error) return false;
    return !!fallback.data;
  }
  const fallback = await supabase.from("brands").select("id").eq("contact_email", normalized).maybeSingle();
  if (fallback.error) return false;
  return !!fallback.data;
}
