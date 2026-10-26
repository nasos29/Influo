import type { SupabaseClient, User } from "@supabase/supabase-js";

export const BRAND_BIO_MAX = 600;

/** Whitelisted columns brands may update on their own profile. */
export const BRAND_PROFILE_WHITELIST = [
  "brand_name",
  "contact_person",
  "website",
  "industry",
  "logo_url",
  "bio",
  "instagram",
  "city",
] as const;

export type BrandProfileField = (typeof BRAND_PROFILE_WHITELIST)[number];

export type PublicBrandProfile = {
  brand_name: string;
  logo_url: string | null;
  bio: string | null;
  city: string | null;
  website: string | null;
  instagram: string | null;
};

/** Resolve brands.id for the logged-in auth user (id match or contact email). */
export async function resolveBrandIdForUser(
  admin: SupabaseClient,
  user: User
): Promise<string | null> {
  const byId = await admin.from("brands").select("id").eq("id", user.id).maybeSingle();
  if (byId.data?.id) return String(byId.data.id);

  const email = (user.email || "").trim();
  if (!email) return null;

  const priv = await admin
    .from("brand_private")
    .select("brand_id")
    .ilike("contact_email", email)
    .maybeSingle();
  if (priv.data?.brand_id) return String(priv.data.brand_id);

  const byEmail = await admin
    .from("brands")
    .select("id")
    .ilike("contact_email", email)
    .maybeSingle();
  return byEmail.data?.id ? String(byEmail.data.id) : null;
}

function trimOrNull(value: string): string | null {
  const t = value.trim();
  return t ? t : null;
}

/** Require https URL; return normalized href or null if empty; throw message key if invalid. */
export function parseHttpsUrl(raw: string, field: "website" | "instagram"): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let withProtocol = trimmed;
  if (!/^https?:\/\//i.test(withProtocol)) {
    withProtocol = `https://${withProtocol}`;
  }

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error(field === "instagram" ? "invalid_instagram" : "invalid_website");
  }

  if (url.protocol !== "https:") {
    throw new Error(field === "instagram" ? "invalid_instagram" : "invalid_website");
  }

  if (field === "instagram") {
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "instagram.com") {
      throw new Error("invalid_instagram");
    }
  }

  return url.toString();
}

export function normalizeBrandBio(raw: string): string | null {
  const bio = trimOrNull(raw);
  if (!bio) return null;
  if (bio.length > BRAND_BIO_MAX) throw new Error("bio_too_long");
  return bio;
}

export function normalizeBrandCity(raw: string): string | null {
  const city = trimOrNull(raw);
  if (!city) return null;
  if (city.length > 120) throw new Error("city_too_long");
  return city;
}
