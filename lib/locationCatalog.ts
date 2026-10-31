import { toGreeklish } from "@/lib/greeklish";
import { LOCATION_SEED, type LocationDraft, type LocationKind } from "@/lib/locationSeed";

export type LocationRecord = {
  name_el: string;
  name_en: string;
  region_el: string;
  region_en: string;
  type: LocationKind;
  country: "GR" | "CY";
  popularity: number;
  search_el: string;
  search_en: string;
  search_latin: string;
};

/** Lowercase, strip accents, and fold final sigma. Spaces stay as single spaces. */
export function foldLocation(value: string): string {
  return String(value || "")
    .toLocaleLowerCase("el")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ς/g, "σ")
    .replace(/\s+/g, " ")
    .trim();
}

function blob(...parts: string[]): string {
  return foldLocation(parts.filter(Boolean).join(" "));
}

export function toLocationRecord(draft: LocationDraft): LocationRecord {
  const aliases = draft.aliases.join(" ");
  return {
    name_el: draft.nameEl,
    name_en: draft.nameEn,
    region_el: draft.regionEl,
    region_en: draft.regionEn,
    type: draft.type,
    country: draft.country,
    popularity: draft.popularity,
    search_el: blob(draft.nameEl, draft.regionEl),
    search_en: blob(draft.nameEn, draft.regionEn, aliases),
    search_latin: blob(toGreeklish(draft.nameEl), toGreeklish(draft.regionEl), aliases),
  };
}

export const LOCATION_SEED_RECORDS: LocationRecord[] = LOCATION_SEED.map(toLocationRecord);

export type LocationHit = LocationRecord & { label: string; region: string };

function score(row: LocationRecord, query: string, latin: string, lang: "el" | "en"): number {
  const name = foldLocation(lang === "en" ? row.name_en : row.name_el);
  const nameLatin = foldLocation(toGreeklish(row.name_el));
  const needles = [query, latin].filter((part) => part.length > 0);
  let best = 3;
  for (const needle of needles) {
    if (name === needle || nameLatin === needle || foldLocation(row.name_en) === needle) best = Math.min(best, 0);
    else if (name.startsWith(needle) || nameLatin.startsWith(needle) || foldLocation(row.name_en).startsWith(needle)) {
      best = Math.min(best, 1);
    } else best = Math.min(best, 2);
  }
  return best;
}

/** Local typeahead. Empty query returns nothing so the field can stay free text. */
export function searchLocations(
  query: string,
  lang: "el" | "en",
  limit = 8,
  rows: LocationRecord[] = LOCATION_SEED_RECORDS
): LocationHit[] {
  const folded = foldLocation(query);
  const latin = foldLocation(toGreeklish(query));
  if (folded.length < 1 && latin.length < 1) return [];
  const hits: LocationHit[] = [];
  for (const row of rows) {
    const blobs = [row.search_el, row.search_en, row.search_latin];
    const matched = blobs.some(
      (value) => (folded && value.includes(folded)) || (latin && value.includes(latin))
    );
    if (!matched) continue;
    hits.push({
      ...row,
      label: lang === "en" ? row.name_en : row.name_el,
      region: lang === "en" ? row.region_en : row.region_el,
    });
  }
  hits.sort(
    (a, b) =>
      score(a, folded, latin, lang) - score(b, folded, latin, lang) ||
      b.popularity - a.popularity ||
      a.label.localeCompare(b.label, lang)
  );
  return hits.slice(0, limit);
}
