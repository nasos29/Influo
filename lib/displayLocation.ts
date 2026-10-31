import { placeTokens, samePlace } from "@/lib/campaignAlert";

type Lang = "el" | "en";

/**
 * Canonical city labels for display (matched via placeTokens / REGION_GROUPS).
 * Keys are a representative latin token from each region group.
 */
const CANONICAL_BY_TOKEN: Record<string, { el: string; en: string }> = {
  athens: { el: "Αθήνα", en: "Athens" },
  athina: { el: "Αθήνα", en: "Athens" },
  attiki: { el: "Αθήνα", en: "Athens" },
  thessaloniki: { el: "Θεσσαλονίκη", en: "Thessaloniki" },
  salonika: { el: "Θεσσαλονίκη", en: "Thessaloniki" },
  patra: { el: "Πάτρα", en: "Patras" },
  patras: { el: "Πάτρα", en: "Patras" },
  iraklio: { el: "Ηράκλειο", en: "Heraklion" },
  heraklion: { el: "Ηράκλειο", en: "Heraklion" },
  chania: { el: "Χανιά", en: "Chania" },
  hania: { el: "Χανιά", en: "Chania" },
  ioannina: { el: "Ιωάννινα", en: "Ioannina" },
  larisa: { el: "Λάρισα", en: "Larissa" },
  larissa: { el: "Λάρισα", en: "Larissa" },
  rhodes: { el: "Ρόδος", en: "Rhodes" },
  rodos: { el: "Ρόδος", en: "Rhodes" },
  corfu: { el: "Κέρκυρα", en: "Corfu" },
  kerkyra: { el: "Κέρκυρα", en: "Corfu" },
  chalkida: { el: "Χαλκίδα", en: "Chalkida" },
  halkida: { el: "Χαλκίδα", en: "Chalkida" },
};

/**
 * Display-only location normalizer: Athina/Athens/Αθηνα → Αθήνα (EL) / Athens (EN), etc.
 * Unknown places are returned trimmed as-is.
 */
export function displayLocation(
  raw: string | null | undefined,
  lang: Lang = "el"
): string {
  const text = String(raw || "").trim();
  if (!text) return "";
  const tokens = placeTokens(text);
  for (const token of tokens) {
    const canon = CANONICAL_BY_TOKEN[token];
    if (canon) return canon[lang];
  }
  return text;
}

/** True when filter query matches a stored location (aliases / accents ignored). */
export function locationFilterMatches(
  stored: string | null | undefined,
  query: string | null | undefined
): boolean {
  const q = String(query || "").trim();
  if (!q) return true;
  const loc = String(stored || "").trim();
  if (!loc) return false;
  if (samePlace(loc, q)) return true;
  // Fallback: accent-folded substring (keeps free-text filters working).
  const fold = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ά|α/g, "α")
      .replace(/έ|ε/g, "ε")
      .replace(/ή|η/g, "η")
      .replace(/ί|ϊ|ι/g, "ι")
      .replace(/ό|ο/g, "ο")
      .replace(/ύ|ϋ|υ/g, "υ")
      .replace(/ώ|ω/g, "ω");
  return fold(loc).includes(fold(q)) || fold(displayLocation(loc, "el")).includes(fold(q));
}
