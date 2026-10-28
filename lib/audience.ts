/**
 * Accepts only age-range strings like "18-24", "25–34", "18 - 24", "18--24", "18/24"
 * with 13 ≤ from < to ≤ 80, or "NN+" with 13–80.
 * Values like "1", "17", "", "?" → false.
 */
export function isValidAgeRange(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const s = String(raw).trim();
  if (!s || s === "?") return false;

  const plus = s.match(/^(\d{1,2})\+$/);
  if (plus) {
    const n = Number(plus[1]);
    return Number.isInteger(n) && n >= 13 && n <= 80;
  }

  const range = s.match(/^(\d{1,2})\s*(?:--|–|-|\/)\s*(\d{1,2})$/);
  if (!range) return false;
  const from = Number(range[1]);
  const to = Number(range[2]);
  if (!Number.isInteger(from) || !Number.isInteger(to)) return false;
  return from >= 13 && from < to && to <= 80;
}
