/**
 * Fixed, CC0-licensed category covers (public/campaign-covers/<key>/1..N.webp).
 * Credits: public/campaign-covers/CREDITS.json. No AI generation.
 */
export const COVER_COUNT = 10;

export const COVER_KEYS = [
  "general", "lifestyle", "fashion", "beauty", "travel", "food", "fitness", "tech", "business", "gaming", "family",
  "home", "pets", "entertainment", "art", "music", "education", "sports", "diy", "eco", "cars", "unboxing",
] as const;
export type CoverKey = (typeof COVER_KEYS)[number];

const BY_CATEGORY: Record<string, CoverKey> = {
  "Γενικά": "general",
  "Lifestyle": "lifestyle",
  "Fashion & Style": "fashion",
  "Beauty & Makeup": "beauty",
  "Travel": "travel",
  "Food & Drink": "food",
  "Health & Fitness": "fitness",
  "Tech & Gadgets": "tech",
  "Business & Finance": "business",
  "Gaming & Esports": "gaming",
  "Parenting & Family": "family",
  "Home & Decor": "home",
  "Pets & Animals": "pets",
  "Comedy & Entertainment": "entertainment",
  "Art & Photography": "art",
  "Music & Dance": "music",
  "Education & Coaching": "education",
  "Sports & Athletes": "sports",
  "DIY & Crafts": "diy",
  "Sustainability & Eco": "eco",
  "Cars & Automotive": "cars",
  "Unboxing": "unboxing",
};

export const COVER_KEY_CATEGORY: Record<CoverKey, string> = Object.fromEntries(
  Object.entries(BY_CATEGORY).map(([cat, key]) => [key, cat])
) as Record<CoverKey, string>;

/** Category may be a single name or a stored list ("A, B" / JSON array); first known wins. */
export function coverKeyFor(category: string | null | undefined): CoverKey {
  const raw = (category || "").trim();
  if (!raw) return "general";
  if (BY_CATEGORY[raw]) return BY_CATEGORY[raw];
  for (const [cat, key] of Object.entries(BY_CATEGORY)) if (raw.includes(cat)) return key;
  return "general";
}

export function coverPath(key: CoverKey, n: number): string {
  return `/campaign-covers/${key}/${Math.min(COVER_COUNT, Math.max(1, Math.floor(n)))}.webp`;
}

export function categoryCovers(key: CoverKey): string[] {
  return Array.from({ length: COVER_COUNT }, (_, i) => coverPath(key, i + 1));
}

export function randomCategoryCover(category: string | null | undefined): string {
  return coverPath(coverKeyFor(category), 1 + Math.floor(Math.random() * COVER_COUNT));
}

/** Stable pick for campaigns that have no saved cover (same seed → same image). */
export function fallbackCategoryCover(category: string | null | undefined, seed: string | null | undefined): string {
  const s = seed || category || "x";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return coverPath(coverKeyFor(category), 1 + (h % COVER_COUNT));
}

export function isStaticCover(url: string | null | undefined): boolean {
  return typeof url === "string" && /^\/campaign-covers\/[a-z]+\/\d{1,2}\.webp$/.test(url);
}
