/**
 * site_settings key `homepage_featured_collaborations` — curated Athos-style showcase
 * (application ids only; playback URLs come from creator_media at load time).
 */

export const HOMEPAGE_FEATURED_COLLABORATIONS_KEY = "homepage_featured_collaborations" as const;

const ATHOS_BRAND_ID = "4d7f24f5-fa4d-4601-bc6a-6a7da8331d49";

export type HomepageFeaturedCollaborationsConfig = {
  brandId: string;
  heroApplicationId: string;
  applicationIds: string[];
};

export const DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS: HomepageFeaturedCollaborationsConfig = {
  brandId: ATHOS_BRAND_ID,
  heroApplicationId: "a0b953c0-bae2-44d4-9222-d5b5fbc385ab",
  applicationIds: [
    "a0b953c0-bae2-44d4-9222-d5b5fbc385ab",
    "0d6f33dc-5010-44b7-9928-6ea7aa095f13",
    "e00c5e4c-4a34-444f-8d92-690f07ae3ede",
    "fb71a97b-af71-4b73-9008-a375842a7a8b",
  ],
};

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

/** Parse DB/json; missing or invalid fields fall back to Athos defaults. */
export function parseHomepageFeaturedCollaborationsSetting(raw: unknown): HomepageFeaturedCollaborationsConfig {
  const base = DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const obj = raw as {
    brandId?: unknown;
    heroApplicationId?: unknown;
    applicationIds?: unknown;
  };
  const brandId = isUuid(obj.brandId) ? obj.brandId : base.brandId;
  const heroApplicationId = isUuid(obj.heroApplicationId)
    ? obj.heroApplicationId
    : base.heroApplicationId;
  const applicationIds: string[] = [];
  if (Array.isArray(obj.applicationIds)) {
    for (const item of obj.applicationIds) {
      if (isUuid(item) && !applicationIds.includes(item)) applicationIds.push(item);
    }
  }
  const mergedIds =
    applicationIds.length > 0
      ? applicationIds
      : [...base.applicationIds];
  const heroInList = mergedIds.includes(heroApplicationId)
    ? heroApplicationId
    : mergedIds[0] || base.heroApplicationId;
  return {
    brandId,
    heroApplicationId: heroInList,
    applicationIds: mergedIds,
  };
}