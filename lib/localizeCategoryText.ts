import { CATEGORIES, categoryTranslations } from "@/lib/categories";

/**
 * Replace known category keys (Travel, Fashion & Style, …) with the EL label
 * when lang is Greek. Longest keys first so "Fashion & Style" wins over "Fashion".
 * Does not call Gemini — display-only.
 */
export function localizeCategoryText(
  text: string | null | undefined,
  lang: "el" | "en"
): string {
  const raw = String(text || "");
  if (!raw || lang !== "el") return raw;

  const keys = [
    ...CATEGORIES.map(String),
    ...Object.keys(categoryTranslations),
  ];
  const unique = [...new Set(keys)].sort((a, b) => b.length - a.length);

  let out = raw;
  for (const key of unique) {
    const label = categoryTranslations[key]?.el;
    if (!label || label === key) continue;
    // Case-insensitive whole-phrase replace (ASCII letters / &).
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "gi"), label);
  }
  return out;
}
