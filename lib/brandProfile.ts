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

const INSTAGRAM_HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

function looksLikeDomain(hostname: string): boolean {
  const host = hostname.replace(/\.$/, "").toLowerCase();
  if (!host || /\s/.test(host)) return false;
  // Require at least one dot (e.g. example.com) — reject bare words.
  if (!host.includes(".")) return false;
  if (host.startsWith(".") || host.endsWith(".") || host.includes("..")) return false;
  return /^[a-z0-9.-]+$/.test(host);
}

function stripTrailingSlash(href: string): string {
  return href.replace(/\/+$/, "") || href;
}

/**
 * Normalize website / Instagram to a canonical https URL (no trailing slash).
 * Accepts bare domains, www., http://, https://. Never rejects solely for http vs https.
 * Instagram also accepts bare @username / username → https://instagram.com/{user}.
 * Empty → null. Invalid domain / handle → throws invalid_website | invalid_instagram.
 */
export function parseHttpsUrl(raw: string, field: "website" | "instagram"): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/\s/.test(trimmed)) {
    throw new Error(field === "instagram" ? "invalid_instagram" : "invalid_website");
  }

  if (field === "instagram") {
    const noAt = trimmed.replace(/^@+/, "");
    const isBareHandle =
      !!noAt &&
      !/^https?:\/\//i.test(noAt) &&
      !/instagram\.com/i.test(noAt) &&
      !/^www\./i.test(noAt) &&
      !noAt.includes("/");
    if (isBareHandle) {
      if (!INSTAGRAM_HANDLE_RE.test(noAt)) throw new Error("invalid_instagram");
      return `https://instagram.com/${noAt}`;
    }
  }

  let withProtocol = trimmed;
  if (!/^https?:\/\//i.test(withProtocol)) {
    withProtocol = `https://${withProtocol}`;
  } else if (/^http:\/\//i.test(withProtocol)) {
    withProtocol = withProtocol.replace(/^http:\/\//i, "https://");
  }

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error(field === "instagram" ? "invalid_instagram" : "invalid_website");
  }

  // Force https even if something odd slipped through.
  url.protocol = "https:";

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (field === "instagram") {
    if (host !== "instagram.com") throw new Error("invalid_instagram");
    // Normalize to https://instagram.com/{path} without trailing slash / www.
    const path = url.pathname.replace(/\/+$/, "") || "";
    const handle = path.replace(/^\//, "").split("/")[0] || "";
    if (handle && !INSTAGRAM_HANDLE_RE.test(handle)) throw new Error("invalid_instagram");
    return handle ? `https://instagram.com/${handle}` : "https://instagram.com";
  }

  if (!looksLikeDomain(url.hostname)) {
    throw new Error("invalid_website");
  }

  url.hash = "";
  // Drop default empty path trailing slash via href cleanup.
  const href = `${url.origin}${url.pathname === "/" ? "" : url.pathname}${url.search}`;
  return stripTrailingSlash(href);
}

/** Public href for stored website/instagram values (adds https:// when missing). */
export function toPublicHttpsHref(raw: string | null | undefined): string | null {
  const t = (raw || "").trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) {
    return t.replace(/^http:\/\//i, "https://");
  }
  return `https://${t}`;
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
