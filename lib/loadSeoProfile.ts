import { unstable_cache } from "next/cache";
import { cache } from "react";
import { loadInfluencerRows } from "@/lib/loadPublicInfluencers";
import { getPastBrandsForInfluencer } from "@/lib/pastBrands";
import { viewModelFromPublicRow, type ProfileViewModel } from "@/lib/profileViewModel";
import { findPrivateFieldPaths, PRICING_SOURCE_COLUMNS, SEO_PROFILE_COLUMNS } from "@/lib/publicInfluencer";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SeoProfile = {
  id: string;
  profile_slug: string | null;
  view: ProfileViewModel;
};

async function loadOne(filter: { id?: string; slug?: string }): Promise<SeoProfile | null> {
  const rows = await loadInfluencerRows(
    [...SEO_PROFILE_COLUMNS, ...PRICING_SOURCE_COLUMNS],
    filter
  );
  const row = rows[0];
  if (!row?.id) return null;
  const past_brands = await getPastBrandsForInfluencer(String(row.id));
  const view = viewModelFromPublicRow({ ...row, past_brands });
  const leaks = findPrivateFieldPaths(view);
  if (leaks.length) {
    throw new Error(`Public profile payload contained private fields: ${leaks.join(", ")}`);
  }
  return {
    id: view.id,
    profile_slug: view.profile_slug || null,
    view,
  };
}

const PROFILE_MISS = "PROFILE_MISS";

function isProfileMiss(error: unknown): boolean {
  if (error instanceof Error && error.message === PROFILE_MISS) return true;
  if (error instanceof Error && error.cause instanceof Error && error.cause.message === PROFILE_MISS) return true;
  return false;
}

/**
 * Hits are cached for an hour and cleared with revalidateTag.
 * Misses throw so unstable_cache does not keep a 404 for that hour.
 */
function cachedProfile(filter: { id?: string; slug?: string }, key: string[], tags: string[]) {
  return unstable_cache(
    async () => {
      const profile = await loadOne(filter);
      if (!profile) throw new Error(PROFILE_MISS);
      return profile;
    },
    key,
    { revalidate: 3600, tags }
  )();
}

async function loadCached(filter: { id?: string; slug?: string }, key: string[], tags: string[]) {
  try {
    return await cachedProfile(filter, key, tags);
  } catch (error) {
    if (isProfileMiss(error)) return null;
    throw error;
  }
}

export const loadSeoProfileById = cache(async (id: string): Promise<SeoProfile | null> => {
  const clean = (id || "").trim();
  if (!UUID_RE.test(clean)) return null;
  return loadCached({ id: clean }, ["seo-profile-id-v2", clean], [`profile-id-${clean}`]);
});

export const loadSeoProfileBySlug = cache(async (slug: string): Promise<SeoProfile | null> => {
  const clean = (slug || "").trim().toLowerCase();
  if (clean.length < 2 || clean.length > 80) return null;
  return loadCached({ slug: clean }, ["seo-profile-slug-v2", clean], [`profile-${clean}`]);
});
