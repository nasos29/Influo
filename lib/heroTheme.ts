/**
 * Category-tinted hero gradients for influencer profiles.
 * Full Tailwind class strings (not dynamically concatenated) so purge keeps them.
 */

export const DEFAULT_HERO_GRADIENT =
  "bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-800";

const HERO_BY_THEME = {
  beautyFashion: "bg-gradient-to-br from-rose-900 via-fuchsia-900 to-purple-900",
  fitnessSports: "bg-gradient-to-br from-emerald-900 via-teal-800 to-teal-900",
  food: "bg-gradient-to-br from-orange-900 via-red-800 to-rose-900",
  travel: "bg-gradient-to-br from-blue-900 via-sky-800 to-cyan-900",
  techGaming: "bg-gradient-to-br from-indigo-950 via-violet-900 to-purple-900",
  lifestyleFamily: "bg-gradient-to-br from-amber-900 via-orange-900 to-rose-900",
} as const;

function firstCategoryToken(category?: string | string[] | null): string {
  if (category == null) return "";
  if (Array.isArray(category)) {
    const first = category.find((c) => String(c || "").trim());
    return first ? String(first).trim() : "";
  }
  const raw = String(category).trim();
  if (!raw) return "";
  // Stored lists are often comma-separated.
  return raw.split(",")[0]?.trim() || raw;
}

/** Strip accents for Greek keyword matching (Ομορφιά → ομορφια). */
function foldCategoryKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9\u0370-\u03ff\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(folded: string, needles: string[]): boolean {
  return needles.some((n) => folded.includes(n));
}

/**
 * Map influencer category → dark Tailwind gradient classes (readable white text).
 * Uses the first category when a list is provided. Case-insensitive; EL + EN keywords.
 */
export function heroGradientForCategory(
  category?: string | string[] | null
): string {
  const folded = foldCategoryKey(firstCategoryToken(category));
  if (!folded) return DEFAULT_HERO_GRADIENT;

  // Order matters: gaming before sports (esports contains "sport").
  if (
    matchesAny(folded, [
      "beauty",
      "makeup",
      "make up",
      "fashion",
      "style",
      "ομορφια",
      "μακιγιαζ",
      "μοδα",
      "στυλ",
    ])
  ) {
    return HERO_BY_THEME.beautyFashion;
  }

  if (
    matchesAny(folded, [
      "tech",
      "gadget",
      "gaming",
      "esport",
      "τεχνολογ",
      "παιχνιδ",
    ])
  ) {
    return HERO_BY_THEME.techGaming;
  }

  if (
    matchesAny(folded, [
      "fitness",
      "sport",
      "athlete",
      "health",
      "γυμνα",
      "αθλη",
      "υγεια",
    ])
  ) {
    return HERO_BY_THEME.fitnessSports;
  }

  if (
    matchesAny(folded, [
      "food",
      "drink",
      "culinary",
      "φαγητ",
      "ποτ",
      "κουζιν",
    ])
  ) {
    return HERO_BY_THEME.food;
  }

  if (matchesAny(folded, ["travel", "ταξιδ"])) {
    return HERO_BY_THEME.travel;
  }

  if (
    matchesAny(folded, [
      "lifestyle",
      "family",
      "parenting",
      "οικογεν",
      "παιδι",
    ])
  ) {
    return HERO_BY_THEME.lifestyleFamily;
  }

  return DEFAULT_HERO_GRADIENT;
}
