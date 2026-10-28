import type { Bilingual } from "@/lib/bilingual";

/** Labels shared by for-brands and for-influencers stats strips. */
export const PLATFORM_STAT_LABELS = {
  influencers: { el: "εγκεκριμένοι influencers", en: "approved influencers" },
  brands: { el: "verified brands", en: "verified brands" },
  campaigns: { el: "ανοιχτές καμπάνιες", en: "open campaigns" },
} as const satisfies Record<string, Bilingual>;

export const MARKETING_SHARED = {
  brand: "Influo",
  howTitle: { el: "Πώς λειτουργεί", en: "How it works" },
  trustTitle: { el: "Γιατί Influo", en: "Why Influo" },
  ctaTitle: { el: "Ξεκινήστε σήμερα", en: "Start today" },
  directory: { el: "Κατάλογος", en: "Directory" },
} as const;
