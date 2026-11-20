import { displayLocation } from "@/lib/displayLocation";

function canonicalCity(raw: string | undefined | null): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";
  if (/^(την|τη|τον|το|στην|στη|στο|στον|από)\s/i.test(trimmed)) {
    return displayLocation(trimmed.replace(/^(την|τη|τον|το|στην|στη|στο|στον|από)\s+/i, ""), "el") || trimmed;
  }
  return displayLocation(trimmed, "el") || trimmed;
}

function startsWithVowelSound(city: string): boolean {
  const c = city.charAt(0).toLowerCase();
  return "αεήιουω".includes(c);
}

function feminineOsDative(city: string): string {
  if (city.endsWith("ος")) return `${city.slice(0, -2)}ο`;
  return city;
}

/** «στην Αθήνα», «στη Ρόδο», «στο Ηράκλειο» */
export function greekInCity(raw: string | undefined | null): string {
  const city = canonicalCity(raw);
  if (!city) return "στην Ελλάδα";
  if (city === "Ελλάδα") return "στην Ελλάδα";
  if (/^(στην|στη|στο|στον)\s/i.test(city)) return city;

  if (city.endsWith("ος")) {
    return `στη ${feminineOsDative(city)}`;
  }
  if (city.endsWith("ο") && !city.endsWith("ιο")) {
    return `στο ${city}`;
  }
  if (city.endsWith("ας") || city.endsWith("ής")) {
    return `στον ${city}`;
  }
  if (city.endsWith("η") || city.endsWith("α")) {
    return `${startsWithVowelSound(city) ? "στην" : "στη"} ${city}`;
  }
  return `στην ${city}`;
}

/** «από την Αθήνα», «από τη Ρόδο», «από το Ηράκλειο» */
export function greekFromPlace(raw: string | undefined | null): string {
  const city = canonicalCity(raw);
  if (!city) return "την Ελλάδα";
  if (city === "Ελλάδα") return "την Ελλάδα";
  if (/^(την|τη|τον|το)\s/i.test(city)) return city;
  if (/^από\s/i.test(city)) return city;

  if (city.endsWith("ος")) {
    return `από τη ${feminineOsDative(city)}`;
  }
  if (city.endsWith("ο") && !city.endsWith("ιο")) {
    return `από το ${city}`;
  }
  if (city.endsWith("ας") || city.endsWith("ής")) {
    return `από τον ${city}`;
  }
  if (city.endsWith("η") || city.endsWith("α")) {
    return `${startsWithVowelSound(city) ? "από την" : "από τη"} ${city}`;
  }
  return `από την ${city}`;
}