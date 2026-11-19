/**
 * Accepts only age-range strings like "18-24", "25–34", "18 - 24", "18--24", "18/24"
 * with 13 ≤ from < to ≤ 80, or "NN+" with 13–80.
 * Values like "1", "17", "", "?" → false.
 */
const PLUS_RE = /^(\d{1,2})\+$/;
const RANGE_RE = /^(\d{1,2})\s*(?:--|–|-|\/)\s*(\d{1,2})$/;

export function isValidAgeRange(raw: string | null | undefined): boolean {
  if (raw == null) return false;
  const s = String(raw).trim();
  if (!s || s === "?") return false;

  const plus = PLUS_RE.exec(s);
  if (plus) {
    const n = Number(plus[1]);
    return Number.isInteger(n) && n >= 13 && n <= 80;
  }

  const range = RANGE_RE.exec(s);
  if (!range) return false;
  const from = Number(range[1]);
  const to = Number(range[2]);
  if (!Number.isInteger(from) || !Number.isInteger(to)) return false;
  return from >= 13 && from < to && to <= 80;
}

/** Known placeholders meaning the age group is not known. Display these as "?". */
const UNKNOWN_AGE_LABELS = new Set([
  "?",
  "δεν την ξέρουμε",
  "δεν την ξερουμε",
  "we don't know",
  "we don’t know",
  "we don't know it",
  "we don’t know it",
  "we do not know",
  "we do not know it",
  "don't know",
  "don’t know",
  "unknown",
]);

/**
 * Value shown on public profile stats for the top age group.
 * Missing or "we don't know" placeholders (Greek or English) become "?",
 * which is the established unknown marker. Real ranges are left as entered.
 */
export function displayAudienceTopAge(raw: string | null | undefined): string {
  if (raw == null) return "?";
  const s = String(raw).trim();
  if (!s) return "?";
  if (UNKNOWN_AGE_LABELS.has(s.toLowerCase())) return "?";
  return s;
}
