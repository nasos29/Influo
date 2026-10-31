export type EuroLang = "el" | "en";

/**
 * Euro sign sits to the right of the amount, with a space: "50 €", "1.000 €".
 * Greek uses dot grouping; English uses comma grouping.
 */
export function formatEuro(
  amount: number,
  lang: EuroLang = "el",
  fractionDigits?: number
): string {
  if (!Number.isFinite(amount)) return "";
  const locale = lang === "en" ? "en-US" : "el-GR";
  const options: Intl.NumberFormatOptions = {};
  if (fractionDigits != null) {
    options.minimumFractionDigits = fractionDigits;
    options.maximumFractionDigits = fractionDigits;
  } else {
    options.minimumFractionDigits = 0;
    options.maximumFractionDigits = Number.isInteger(amount) ? 0 : 2;
  }
  return `${amount.toLocaleString(locale, options)} €`;
}

/**
 * Parse a stored price. "1.500" and "1,500" are thousands; "12,50" is a decimal.
 * Returns null when the text is not a single amount.
 */
export function parseEuroNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const text = value.replace(/€/g, "").replace(/\s/g, "");
  if (!text || text.startsWith("-")) return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(text)) return Number(text.replace(/\./g, ""));
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) return Number(text.replace(/,/g, ""));
  if (/^\d+,\d+$/.test(text)) return Number(text.replace(",", "."));
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  return null;
}

/** Format a number or numeric string. Empty string when it is not an amount. */
export function formatEuroAmount(
  amount: unknown,
  lang: EuroLang = "el",
  fractionDigits?: number
): string {
  const n = parseEuroNumber(amount);
  if (n == null) return "";
  return formatEuro(n, lang, fractionDigits);
}
