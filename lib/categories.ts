/**
 * Single category list for influencers and brands.
 * Stored values stay text: one key, or several keys joined with commas
 * (same shape as influencers.category). Keys are English except "Γενικά".
 */

export const GENERAL_CATEGORY = "Γενικά";

export const CATEGORIES = [
  "Γενικά",
  "Lifestyle",
  "Fashion & Style",
  "Beauty & Makeup",
  "Travel",
  "Food & Drink",
  "Health & Fitness",
  "Tech & Gadgets",
  "Business & Finance",
  "Gaming & Esports",
  "Parenting & Family",
  "Home & Decor",
  "Pets & Animals",
  "Comedy & Entertainment",
  "Art & Photography",
  "Music & Dance",
  "Education & Coaching",
  "Sports & Athletes",
  "DIY & Crafts",
  "Sustainability & Eco",
  "Cars & Automotive",
  "Unboxing",
] as const;

export type CategoryKey = (typeof CATEGORIES)[number];

export const categoryTranslations: { [key: string]: { el: string; en: string } } = {
  "Γενικά": { el: "Γενικά", en: "General" },
  "Lifestyle": { el: "Lifestyle", en: "Lifestyle" },
  "Fashion & Style": { el: "Μόδα & Στυλ", en: "Fashion & Style" },
  "Beauty & Makeup": { el: "Ομορφιά & Μακιγιάζ", en: "Beauty & Makeup" },
  "Travel": { el: "Ταξίδια", en: "Travel" },
  "Food & Drink": { el: "Φαγητό & Ποτά", en: "Food & Drink" },
  "Health & Fitness": { el: "Υγεία & Fitness", en: "Health & Fitness" },
  "Tech & Gadgets": { el: "Τεχνολογία & Gadgets", en: "Tech & Gadgets" },
  "Business & Finance": { el: "Επιχειρήσεις & Οικονομικά", en: "Business & Finance" },
  "Gaming & Esports": { el: "Gaming & Esports", en: "Gaming & Esports" },
  "Parenting & Family": { el: "Οικογένεια & Παιδιά", en: "Parenting & Family" },
  "Home & Decor": { el: "Σπίτι & Διακόσμηση", en: "Home & Decor" },
  "Pets & Animals": { el: "Κατοικίδια & Ζώα", en: "Pets & Animals" },
  "Comedy & Entertainment": { el: "Κωμωδία & Ψυχαγωγία", en: "Comedy & Entertainment" },
  "Art & Photography": { el: "Τέχνη & Φωτογραφία", en: "Art & Photography" },
  "Music & Dance": { el: "Μουσική & Χορός", en: "Music & Dance" },
  "Education & Coaching": { el: "Εκπαίδευση & Coaching", en: "Education & Coaching" },
  "Sports & Athletes": { el: "Αθλήματα & Αθλητές", en: "Sports & Athletes" },
  "DIY & Crafts": { el: "DIY & Χειροτεχνίες", en: "DIY & Crafts" },
  "Sustainability & Eco": { el: "Βιωσιμότητα & Οικολογία", en: "Sustainability & Eco" },
  "Cars & Automotive": { el: "Αυτοκίνητα", en: "Cars & Automotive" },
  "Unboxing": { el: "Unboxing", en: "Unboxing" },
};

/** Old spellings, short names, and Greek/English labels → canonical key. */
const EXTRA_ALIASES: Record<string, CategoryKey> = {
  general: "Γενικά",
  "general all categories": "Γενικά",
  γενικα: "Γενικά",
  beauty: "Beauty & Makeup",
  makeup: "Beauty & Makeup",
  "make up": "Beauty & Makeup",
  "make-up": "Beauty & Makeup",
  "beauty makeup": "Beauty & Makeup",
  "beauty and makeup": "Beauty & Makeup",
  "beauty & make-up": "Beauty & Makeup",
  "beauty and make-up": "Beauty & Makeup",
  ομορφια: "Beauty & Makeup",
  μακιγιαζ: "Beauty & Makeup",
  "ομορφια & μακιγιαζ": "Beauty & Makeup",
  "ομορφια και μακιγιαζ": "Beauty & Makeup",
  fashion: "Fashion & Style",
  "fashion and style": "Fashion & Style",
  "fashion style": "Fashion & Style",
  μοδα: "Fashion & Style",
  "μοδα & στυλ": "Fashion & Style",
  "μοδα και στυλ": "Fashion & Style",
  στυλ: "Fashion & Style",
  travel: "Travel",
  ταξιδια: "Travel",
  food: "Food & Drink",
  "food and drink": "Food & Drink",
  "food drink": "Food & Drink",
  φαγητο: "Food & Drink",
  "φαγητο & ποτα": "Food & Drink",
  "φαγητο και ποτα": "Food & Drink",
  fitness: "Health & Fitness",
  health: "Health & Fitness",
  "health and fitness": "Health & Fitness",
  "health fitness": "Health & Fitness",
  υγεια: "Health & Fitness",
  "υγεια & fitness": "Health & Fitness",
  "υγεια και fitness": "Health & Fitness",
  tech: "Tech & Gadgets",
  technology: "Tech & Gadgets",
  gadgets: "Tech & Gadgets",
  "tech and gadgets": "Tech & Gadgets",
  "tech gadgets": "Tech & Gadgets",
  τεχνολογια: "Tech & Gadgets",
  "τεχνολογια & gadgets": "Tech & Gadgets",
  "τεχνολογια και gadgets": "Tech & Gadgets",
  business: "Business & Finance",
  finance: "Business & Finance",
  "business and finance": "Business & Finance",
  "business finance": "Business & Finance",
  επιχειρησεις: "Business & Finance",
  οικονομικα: "Business & Finance",
  "επιχειρησεις & οικονομικα": "Business & Finance",
  "επιχειρησεις και οικονομικα": "Business & Finance",
  gaming: "Gaming & Esports",
  esports: "Gaming & Esports",
  "gaming and esports": "Gaming & Esports",
  "gaming esports": "Gaming & Esports",
  parenting: "Parenting & Family",
  family: "Parenting & Family",
  "parenting and family": "Parenting & Family",
  οικογενεια: "Parenting & Family",
  "οικογενεια & παιδια": "Parenting & Family",
  "οικογενεια και παιδια": "Parenting & Family",
  home: "Home & Decor",
  decor: "Home & Decor",
  "home and decor": "Home & Decor",
  "home decor": "Home & Decor",
  σπιτι: "Home & Decor",
  διακοσμηση: "Home & Decor",
  "σπιτι & διακοσμηση": "Home & Decor",
  "σπιτι και διακοσμηση": "Home & Decor",
  pets: "Pets & Animals",
  animals: "Pets & Animals",
  "pets and animals": "Pets & Animals",
  κατοικιδια: "Pets & Animals",
  "κατοικιδια & ζωα": "Pets & Animals",
  "κατοικιδια και ζωα": "Pets & Animals",
  comedy: "Comedy & Entertainment",
  entertainment: "Comedy & Entertainment",
  "comedy and entertainment": "Comedy & Entertainment",
  κωμωδια: "Comedy & Entertainment",
  ψυχαγωγια: "Comedy & Entertainment",
  "κωμωδια & ψυχαγωγια": "Comedy & Entertainment",
  "κωμωδια και ψυχαγωγια": "Comedy & Entertainment",
  art: "Art & Photography",
  photography: "Art & Photography",
  "art and photography": "Art & Photography",
  τεχνη: "Art & Photography",
  φωτογραφια: "Art & Photography",
  "τεχνη & φωτογραφια": "Art & Photography",
  "τεχνη και φωτογραφια": "Art & Photography",
  music: "Music & Dance",
  dance: "Music & Dance",
  "music and dance": "Music & Dance",
  μουσικη: "Music & Dance",
  χορος: "Music & Dance",
  "μουσικη & χορος": "Music & Dance",
  "μουσικη και χορος": "Music & Dance",
  education: "Education & Coaching",
  coaching: "Education & Coaching",
  "education and coaching": "Education & Coaching",
  εκπαιδευση: "Education & Coaching",
  "εκπαιδευση & coaching": "Education & Coaching",
  "εκπαιδευση και coaching": "Education & Coaching",
  sports: "Sports & Athletes",
  athletes: "Sports & Athletes",
  "sports and athletes": "Sports & Athletes",
  αθληματα: "Sports & Athletes",
  αθλητες: "Sports & Athletes",
  "αθληματα & αθλητες": "Sports & Athletes",
  "αθληματα και αθλητες": "Sports & Athletes",
  diy: "DIY & Crafts",
  crafts: "DIY & Crafts",
  "diy and crafts": "DIY & Crafts",
  χειροτεχνιες: "DIY & Crafts",
  "diy & χειροτεχνιες": "DIY & Crafts",
  "diy και χειροτεχνιες": "DIY & Crafts",
  sustainability: "Sustainability & Eco",
  eco: "Sustainability & Eco",
  "sustainability and eco": "Sustainability & Eco",
  βιωσιμοτητα: "Sustainability & Eco",
  οικολογια: "Sustainability & Eco",
  "βιωσιμοτητα & οικολογια": "Sustainability & Eco",
  "βιωσιμοτητα και οικολογια": "Sustainability & Eco",
  cars: "Cars & Automotive",
  automotive: "Cars & Automotive",
  "cars and automotive": "Cars & Automotive",
  αυτοκινητα: "Cars & Automotive",
  unboxing: "Unboxing",
  lifestyle: "Lifestyle",
};

const CANONICAL = new Set<string>(CATEGORIES);

function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ς/g, "σ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9α-ω\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const FOLDED_TO_KEY = new Map<string, string>();
for (const key of CATEGORIES) {
  FOLDED_TO_KEY.set(fold(key), key);
  FOLDED_TO_KEY.set(fold(categoryTranslations[key].el), key);
  FOLDED_TO_KEY.set(fold(categoryTranslations[key].en), key);
}
for (const [alias, key] of Object.entries(EXTRA_ALIASES)) {
  FOLDED_TO_KEY.set(fold(alias), key);
}

export function isGeneralCategory(value: string | null | undefined): boolean {
  const key = normalizeCategoryToken(value);
  return key === GENERAL_CATEGORY;
}

/** Map one stored token to a canonical key. Unknown non-empty text is kept. */
export function normalizeCategoryToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (CANONICAL.has(trimmed)) return trimmed;
  return FOLDED_TO_KEY.get(fold(trimmed)) || trimmed;
}

export function parseStoredCategories(value: unknown): string[] {
  const rawParts: string[] = [];
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") rawParts.push(item);
    }
  } else if (typeof value === "string") {
    rawParts.push(...value.split(","));
  } else if (value != null && typeof value !== "object") {
    rawParts.push(String(value));
  }

  const out: string[] = [];
  for (const part of rawParts) {
    const key = normalizeCategoryToken(part);
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

/** Canonical keys, comma-separated, no spaces. Empty string when nothing is selected. */
export function formatStoredCategories(value: unknown): string {
  return parseStoredCategories(value).join(",");
}

export function categoryLabel(value: unknown, lang: "el" | "en" = "el"): string {
  const key = normalizeCategoryToken(typeof value === "string" ? value : "");
  if (!key) return "";
  return categoryTranslations[key]?.[lang] || key;
}

export function formatCategoryLabels(value: unknown, lang: "el" | "en" = "el"): string {
  return parseStoredCategories(value)
    .map((key) => categoryTranslations[key]?.[lang] || key)
    .join(", ");
}

/** True when a stored category list contains the filter key (after alias normalization). */
export function categoriesMatchFilter(stored: unknown, filter: string | null | undefined): boolean {
  if (!filter || filter === "All" || filter === "all") return true;
  const wanted = normalizeCategoryToken(filter);
  if (!wanted) return false;
  return parseStoredCategories(stored).includes(wanted);
}

/** Keywords for directory / brand pages, including Unboxing in both languages. */
export function categorySeoKeywords(): string[] {
  const words = new Set<string>();
  for (const key of CATEGORIES) {
    words.add(key);
    words.add(categoryTranslations[key].el);
    words.add(categoryTranslations[key].en);
  }
  words.add("unboxing influencer");
  words.add("unboxing Ελλάδα");
  return [...words];
}

/** Neighbouring niches used to widen creator matching when a category has few creators. */
export const RELATED_CATEGORIES: Record<string, string[]> = {
  "Cars & Automotive": ["Tech & Gadgets", "Lifestyle", "Unboxing", "Travel", "Sports & Athletes"],
  "Tech & Gadgets": ["Gaming & Esports", "Unboxing", "Lifestyle", "Business & Finance"],
  "Gaming & Esports": ["Tech & Gadgets", "Comedy & Entertainment"],
  "Sports & Athletes": ["Health & Fitness", "Lifestyle"],
  "Health & Fitness": ["Sports & Athletes", "Lifestyle", "Food & Drink"],
  "Beauty & Makeup": ["Fashion & Style", "Lifestyle"],
  "Fashion & Style": ["Beauty & Makeup", "Lifestyle"],
  "Food & Drink": ["Lifestyle", "Travel", "Health & Fitness"],
  "Travel": ["Lifestyle", "Food & Drink", "Art & Photography"],
  "Home & Decor": ["Lifestyle", "DIY & Crafts", "Parenting & Family"],
  "DIY & Crafts": ["Home & Decor", "Art & Photography", "Lifestyle"],
  "Parenting & Family": ["Lifestyle", "Home & Decor", "Education & Coaching"],
  "Pets & Animals": ["Lifestyle", "Parenting & Family"],
  "Business & Finance": ["Education & Coaching", "Tech & Gadgets"],
  "Education & Coaching": ["Business & Finance", "Parenting & Family"],
  "Comedy & Entertainment": ["Music & Dance", "Lifestyle"],
  "Music & Dance": ["Comedy & Entertainment", "Art & Photography"],
  "Art & Photography": ["DIY & Crafts", "Travel", "Lifestyle"],
  "Sustainability & Eco": ["Lifestyle", "Home & Decor", "Food & Drink"],
  "Unboxing": ["Tech & Gadgets", "Lifestyle", "Beauty & Makeup"],
  "Lifestyle": ["Fashion & Style", "Travel", "Food & Drink"],
};

const CATEGORY_SYNONYMS: Array<[RegExp, string]> = [
  [/auto|car|vehicle|αυτοκ[ιί]νητ|οχ[ηή]μ|moto/i, "Cars & Automotive"],
  [/tech|gadget|electronic|τεχνολογ/i, "Tech & Gadgets"],
  [/gam|esport/i, "Gaming & Esports"],
  [/sport|athlet|αθλητ/i, "Sports & Athletes"],
  [/fitness|health|gym|υγε/i, "Health & Fitness"],
  [/beauty|makeup|cosmetic|skin|ομορφ|καλλυντ/i, "Beauty & Makeup"],
  [/fashion|style|cloth|apparel|μόδα|μοδα|ρο[υύ]χ/i, "Fashion & Style"],
  [/food|drink|restaurant|cafe|φαγητ|εστιατ/i, "Food & Drink"],
  [/travel|hotel|tourism|ταξ[ιί]δ|ξενοδοχ/i, "Travel"],
  [/home|decor|furnit|σπ[ιί]τι|επιπλ/i, "Home & Decor"],
  [/diy|craft|χειροτεχν/i, "DIY & Crafts"],
  [/parent|family|kid|baby|οικογ|παιδ/i, "Parenting & Family"],
  [/pet|animal|dog|cat|κατοικ/i, "Pets & Animals"],
  [/business|finance|bank|οικονομ|επιχειρ/i, "Business & Finance"],
  [/educat|coach|course|εκπαιδ/i, "Education & Coaching"],
  [/comedy|entertain|ψυχαγωγ/i, "Comedy & Entertainment"],
  [/music|dance|μουσικ|χορ/i, "Music & Dance"],
  [/art|photo|τέχνη|τεχνη|φωτογρ/i, "Art & Photography"],
  [/eco|sustain|green|περιβαλλ/i, "Sustainability & Eco"],
  [/unbox/i, "Unboxing"],
  [/lifestyle/i, "Lifestyle"],
];

/** Map free AI/user text to a valid site category key ("" when nothing fits). */
export function toSiteCategory(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const v = value.trim();
  const exact = (CATEGORIES as readonly string[]).find((c) => c.toLowerCase() === v.toLowerCase());
  if (exact) return exact;
  for (const [re, cat] of CATEGORY_SYNONYMS) if (re.test(v)) return cat;
  return "";
}
