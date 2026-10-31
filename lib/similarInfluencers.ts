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
  analytics_verified?: boolean | null;
  location?: string | null;
  /** Ceiling tier for filters. Guest copy uses `from_price`. */
  price_tier?: string | null;
  /** Exact lowest price for «Από X €». */
  from_price?: number | null;
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

export function normalizePlatformList(platforms: unknown): string[] {
  if (!Array.isArray(platforms)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of platforms) {
    const key = String(raw || "")
      .trim()
      .toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function platformsFromAccounts(accounts: unknown): string[] {
  if (!Array.isArray(accounts)) return [];
  return normalizePlatformList(
    accounts.map((acc) =>
      acc && typeof acc === "object" ? (acc as SimilarAccount).platform : null
    )
  );
}

export function sharesPlatform(currentPlatforms: string[], accounts: unknown): boolean {
  const wanted = new Set(normalizePlatformList(currentPlatforms));
  if (!wanted.size) return false;
  return platformsFromAccounts(accounts).some((p) => wanted.has(p));
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
 * Pick up to `limit` similar creators: exclude self, prefer shared category,
 * then same platform. Shuffle within each tier (call from client/API only).
 */
export function pickSimilarInfluencers(
  currentId: string,
  currentCategories: string[],
  rows: SimilarInfluencerRow[],
  limit = 8,
  random?: RandomFn,
  currentPlatforms: string[] = []
): SimilarInfluencerRow[] {
  const self = String(currentId || "");
  const cats = currentCategories.filter(Boolean);
  const plats = normalizePlatformList(currentPlatforms);
  if (!self || !rows.length) return [];
  if (!cats.length && !plats.length) return [];

  const withCategory: SimilarInfluencerRow[] = [];
  const platformOnly: SimilarInfluencerRow[] = [];

  for (const row of rows) {
    if (!row?.id || String(row.id) === self) continue;
    const catShare = sharedCategoryCount(cats, row.category);
    const platShare = sharesPlatform(plats, row.accounts);
    if (catShare > 0) withCategory.push(row);
    else if (platShare) platformOnly.push(row);
  }

  const rnd = random ?? cryptoUnitRandom;
  // Tier 1: shared category (shuffle). Tier 2: same platform only (shuffle).
  const tier1 = shuffle(withCategory, rnd);
  const tier2 = shuffle(platformOnly, rnd);
  return [...tier1, ...tier2].slice(0, Math.max(0, limit));
}
