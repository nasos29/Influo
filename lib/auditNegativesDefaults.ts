/**
 * Helpers for AI audit "negatives" arrays — trim only; empty arrays are valid when there is nothing noteworthy.
 */

export function cleanNegativesLists(
  negatives?: string[] | null,
  negatives_en?: string[] | null
): { negatives: string[]; negatives_en: string[] } {
  const el = Array.isArray(negatives)
    ? negatives.map((s) => String(s ?? "").trim()).filter(Boolean)
    : [];
  const en = Array.isArray(negatives_en)
    ? negatives_en.map((s) => String(s ?? "").trim()).filter(Boolean)
    : [];
  return { negatives: el, negatives_en: en };
}
