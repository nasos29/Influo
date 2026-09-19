export const GENDER_VALUES = ["Female", "Male", "AI"] as const;
export type GenderValue = (typeof GENDER_VALUES)[number];

/** Stored DB values: Male / Female / AI. Legacy "Other" maps to AI. */
export function normalizeGender(
  raw: string | null | undefined,
  fallback: GenderValue = "Female"
): GenderValue {
  if (raw === "Male" || raw === "Female" || raw === "AI") return raw;
  if (raw === "Other") return "AI";
  return fallback;
}

export function genderLabel(raw: string | null | undefined, lang: "el" | "en"): string {
  const g = normalizeGender(raw);
  if (g === "Male") return lang === "el" ? "Άνδρας" : "Male";
  if (g === "AI") return "AI";
  return lang === "el" ? "Γυναίκα" : "Female";
}
