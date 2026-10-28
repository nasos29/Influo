import { parseStoredCategories } from "@/lib/categories";
import { totalFollowersFromAccounts } from "@/lib/parseFollowers";

export type SimilarAccount = {
  platform?: string;
  username?: string;
  followers?: string | number | null;
};

export type SimilarInfluencerRow = {
  id: string;
  display_name: string | null;
  profile_slug: string | null;
  avatar_url: string | null;
  category: string | null;
  accounts?: SimilarAccount[] | null;
  verified?: boolean | null;
};

/** Returns a float in [0, 1). Injected in tests for determinism. */
export type RandomFn = () => number;

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

/**
 * Sum followers from `accounts` the same way Directory does
 * (`parseFollowerString(acc.followers)` per account).
 */
export function followerTotalFromAccounts(accounts: unknown): number {
  if (!Array.isArray(accounts)) return 0;
  return totalFollowersFromAccounts(
    accounts as { followers?: string | number | null }[]
  );
}

export function sharedCategoryCount(currentCats: string[], otherCategory: unknown): number {
  if (!currentCats.length) return 0;
  const wanted = new Set(currentCats);
  return parseStoredCategories(otherCategory).filter((c) => wanted.has(c)).length;
}

/** Uniform [0, 1) via crypto.getRandomValues (avoids Math.random Sonar hotspot). */
function cryptoUnitRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! / 0x1_0000_0000;
}

/**
 * Fisher–Yates shuffle. Uses crypto by default; pass `random` in tests.
 * Returns a new array (does not mutate input).
 */
export function shuffle<T>(items: readonly T[], random: RandomFn = cryptoUnitRandom): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Pick up to `limit` similar creators: share ≥1 category, exclude self,
 * then Fisher–Yates shuffle (call from client useEffect only).
 */
export function pickSimilarInfluencers(
  currentId: string,
  currentCategories: string[],
  rows: SimilarInfluencerRow[],
  limit = 6,
  random?: RandomFn
): SimilarInfluencerRow[] {
  const self = String(currentId || "");
  const cats = currentCategories.filter(Boolean);
  if (!self || !cats.length || !rows.length) return [];

  const filtered = rows.filter((row) => {
    if (!row?.id || String(row.id) === self) return false;
    return sharedCategoryCount(cats, row.category) > 0;
  });

  return shuffle(filtered, random ?? cryptoUnitRandom).slice(0, Math.max(0, limit));
}
