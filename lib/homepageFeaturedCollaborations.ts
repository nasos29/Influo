/**
 * site_settings key `homepage_featured_collaborations` — curated Athos-style showcase
 * (campaign_application UUIDs or `proposal:<id>`; playback URLs come from creator_media at load time).
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
    "proposal:59",
  ],
};

export function isFeaturedCollaborationUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

/** Numeric proposals id from curated key `proposal:N`, or null. */
export function parseFeaturedCollaborationProposalId(curatedId: string): number | null {
  const match = /^proposal:(\d+)$/.exec(curatedId);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Campaign application UUID or `proposal:<positive int>`. */
export function isCuratedFeaturedCollaborationId(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  const trimmed = value.trim();
  if (isFeaturedCollaborationUuid(trimmed)) return true;
  return parseFeaturedCollaborationProposalId(trimmed) !== null;
}

/** Parse DB/json; missing or invalid fields fall back to Athos defaults. */
export const HOMEPAGE_FEATURED_COLLABORATION_SLOT_COUNT = 5;

/** Five display slots for admin (slot 1 = hero); pads from defaults when stored list is short. */
export function featuredCollaborationSlotsFromConfig(
  config: HomepageFeaturedCollaborationsConfig
): string[] {
  const base = DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS;
  const ids =
    config.applicationIds.length > 0 ? [...config.applicationIds] : [...base.applicationIds];
  const hero = isCuratedFeaturedCollaborationId(config.heroApplicationId)
    ? config.heroApplicationId.trim()
    : ids[0] || base.heroApplicationId;

  const slots: string[] = [hero];
  for (const id of ids) {
    const t = typeof id === "string" ? id.trim() : "";
    if (!isCuratedFeaturedCollaborationId(t) || t === hero) continue;
    if (slots.length >= HOMEPAGE_FEATURED_COLLABORATION_SLOT_COUNT) break;
    if (!slots.includes(t)) slots.push(t);
  }
  for (const id of base.applicationIds) {
    if (slots.length >= HOMEPAGE_FEATURED_COLLABORATION_SLOT_COUNT) break;
    if (!slots.includes(id)) slots.push(id);
  }
  return slots.slice(0, HOMEPAGE_FEATURED_COLLABORATION_SLOT_COUNT);
}

/** Build persisted config from exactly five unique curated ids (slot 1 = hero). */
export function homepageFeaturedCollaborationsConfigFromSlots(
  slots: readonly string[]
): HomepageFeaturedCollaborationsConfig | null {
  if (slots.length !== HOMEPAGE_FEATURED_COLLABORATION_SLOT_COUNT) return null;
  const normalized: string[] = [];
  for (const raw of slots) {
    if (!isCuratedFeaturedCollaborationId(raw)) return null;
    const t = raw.trim();
    if (normalized.includes(t)) return null;
    normalized.push(t);
  }
  const base = DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS;
  return {
    brandId: base.brandId,
    heroApplicationId: normalized[0]!,
    applicationIds: normalized,
  };
}

export function parseHomepageFeaturedCollaborationsSetting(raw: unknown): HomepageFeaturedCollaborationsConfig {
  const base = DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const obj = raw as {
    brandId?: unknown;
    heroApplicationId?: unknown;
    applicationIds?: unknown;
  };
  const brandId = isFeaturedCollaborationUuid(obj.brandId) ? obj.brandId : base.brandId;
  const heroApplicationId = isCuratedFeaturedCollaborationId(obj.heroApplicationId)
    ? obj.heroApplicationId.trim()
    : base.heroApplicationId;
  const applicationIds: string[] = [];
  if (Array.isArray(obj.applicationIds)) {
    for (const item of obj.applicationIds) {
      if (
        isCuratedFeaturedCollaborationId(item) &&
        !applicationIds.includes(item.trim())
      ) {
        applicationIds.push(item.trim());
      }
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