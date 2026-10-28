import { parseStoredCategories } from "@/lib/categories";
import { parseFollowerString } from "@/lib/parseFollowers";

export type SimilarInfluencerRow = {
  id: string;
  display_name: string | null;
  profile_slug: string | null;
  avatar_url: string | null;
  category: string | null;
  followers: unknown;
  verified?: boolean | null;
};

/**
 * Escape special characters for a PostgREST `.or()` filter value
 * (commas / parens split clauses; % is an ilike wildcard).
 */
export function escapePostgrestOrValue(value: string): string {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/,/g, "\\,")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/** Build `category.ilike.%X%,category.ilike.%Y%` for supabase `.or(...)`. */
export function categoryIlikeOrFilter(categories: string[]): string | null {
  const parts: string[] = [];
  for (const raw of categories) {
    const cat = String(raw || "").trim();
    if (!cat) continue;
    parts.push(`category.ilike.%${escapePostgrestOrValue(cat)}%`);
  }
  return parts.length ? parts.join(",") : null;
}

/** Best-effort follower total from a scalar or per-platform map. */
export function followerTotalFromField(followers: unknown): number {
  if (typeof followers === "number" && Number.isFinite(followers)) {
    return Math.max(0, followers);
  }
  if (typeof followers === "string") {
    return parseFollowerString(followers);
  }
  if (followers && typeof followers === "object" && !Array.isArray(followers)) {
    let sum = 0;
    for (const value of Object.values(followers as Record<string, unknown>)) {
      sum += parseFollowerString(value as string | number | null | undefined);
    }
    return sum;
  }
  return 0;
}

export function sharedCategoryCount(currentCats: string[], otherCategory: unknown): number {
  if (!currentCats.length) return 0;
  const wanted = new Set(currentCats);
  return parseStoredCategories(otherCategory).filter((c) => wanted.has(c)).length;
}

/**
 * Pick up to `limit` similar creators: share ≥1 category, exclude self,
 * sort by shared categories desc then followers desc.
 */
export function pickSimilarInfluencers(
  currentId: string,
  currentCategories: string[],
  rows: SimilarInfluencerRow[],
  limit = 6
): SimilarInfluencerRow[] {
  const self = String(currentId || "");
  const cats = currentCategories.filter(Boolean);
  if (!self || !cats.length || !rows.length) return [];

  return rows
    .filter((row) => {
      if (!row?.id || String(row.id) === self) return false;
      return sharedCategoryCount(cats, row.category) > 0;
    })
    .sort((a, b) => {
      const shareDiff =
        sharedCategoryCount(cats, b.category) - sharedCategoryCount(cats, a.category);
      if (shareDiff !== 0) return shareDiff;
      return followerTotalFromField(b.followers) - followerTotalFromField(a.followers);
    })
    .slice(0, limit);
}
