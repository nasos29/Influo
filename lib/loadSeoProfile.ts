import { cache } from "react";
import { loadInfluencerRows } from "@/lib/loadPublicInfluencers";
import { viewModelFromPublicRow, type ProfileViewModel } from "@/lib/profileViewModel";
import { findPrivateFieldPaths, SEO_PROFILE_COLUMNS } from "@/lib/publicInfluencer";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SeoProfile = {
  id: string;
  profile_slug: string | null;
  view: ProfileViewModel;
};

async function loadOne(filter: { id?: string; slug?: string }): Promise<SeoProfile | null> {
  const rows = await loadInfluencerRows(SEO_PROFILE_COLUMNS, filter);
  const row = rows[0];
  if (!row?.id) return null;
  const view = viewModelFromPublicRow(row);
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

export const loadSeoProfileById = cache(async (id: string): Promise<SeoProfile | null> => {
  const clean = (id || "").trim();
  if (!UUID_RE.test(clean)) return null;
  return loadOne({ id: clean });
});

export const loadSeoProfileBySlug = cache(async (slug: string): Promise<SeoProfile | null> => {
  const clean = (slug || "").trim().toLowerCase();
  if (clean.length < 2 || clean.length > 80) return null;
  return loadOne({ slug: clean });
});
