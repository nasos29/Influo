/**
 * site_settings key `homepage_brand_cta_decorative_photo` — decorative food collage
 * beside the homepage brand_cta featured collaborations showcase.
 */

export const HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO_KEY =
  "homepage_brand_cta_decorative_photo" as const;

export const DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO = "/images/athos-food-falling.webp";

function isAllowedDecorativePhotoUrl(value: string): boolean {
  const t = value.trim();
  if (!t) return false;
  if (t.startsWith("/") && !t.startsWith("//")) return true;
  try {
    const u = new URL(t);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Parse DB/json; empty/invalid → baked-in default path. */
export function parseHomepageBrandCtaDecorativePhotoSetting(raw: unknown): string {
  if (raw === null || raw === undefined) {
    return DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO;
  }
  if (typeof raw === "string" && isAllowedDecorativePhotoUrl(raw)) {
    return raw.trim();
  }
  return DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO;
}

export function serializeHomepageBrandCtaDecorativePhotoSetting(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed === DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO) {
    return null;
  }
  if (!isAllowedDecorativePhotoUrl(trimmed)) return null;
  return trimmed;
}