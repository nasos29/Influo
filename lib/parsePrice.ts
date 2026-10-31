/**
 * One price parser for packages, «Από», minimum charge, automatic min_rate, and budget filters.
 *
 * Accepts a number, "30", "30 €", "€30", thousands ("1.000" / "1,000"),
 * decimals ("12,50" / "12.50"), and ranges ("30-100", "30 - 100", "30–100").
 * A range keeps both ends for the service card and uses the lower end everywhere
 * a single amount is required. Anything else is ignored.
 */

import { formatEuro, parseEuroNumber, type EuroLang } from "@/lib/formatEuro";

export type ParsedListedPrice = {
  /** Inclusive lower bound. Used for minimums, «Από», and filters. */
  min: number;
  /** Inclusive upper bound when the source is a range. */
  max: number | null;
};

const ASK_RE = /^(ask|ρώτησε|ρωτησε)$/i;
/** Hyphen, en dash, or em dash between two amounts. Not a thousands separator. */
const RANGE_RE = /^(.+?)\s*[-–—]\s*(.+)$/;

function positiveAmount(value: unknown): number | null {
  const n = parseEuroNumber(value);
  if (n == null || !(n > 0)) return null;
  return n;
}

export function parseListedPrice(value: unknown): ParsedListedPrice | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !(value > 0)) return null;
    return { min: value, max: null };
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || ASK_RE.test(trimmed)) return null;

  const range = trimmed.match(RANGE_RE);
  if (range) {
    const min = positiveAmount(range[1]);
    const max = positiveAmount(range[2]);
    if (min == null || max == null || max < min) return null;
    if (max === min) return { min, max: null };
    return { min, max };
  }

  const single = positiveAmount(trimmed);
  if (single == null) return null;
  return { min: single, max: null };
}

/** Lower bound, or null when the value is not a price. */
export function listedPriceMin(value: unknown): number | null {
  return parseListedPrice(value)?.min ?? null;
}

export function isListedPrice(value: unknown): boolean {
  return parseListedPrice(value) != null;
}

function amountText(amount: number, lang: EuroLang): string {
  return formatEuro(amount, lang).replace(/\s*€$/, "");
}

/** "30–100 €" for a range, "500 €" for one amount, "" when the value is ignored. */
export function formatListedPrice(value: unknown, lang: EuroLang = "el"): string {
  const parsed = parseListedPrice(value);
  if (!parsed) return "";
  if (parsed.max != null) return formatPriceSpan(parsed.min, parsed.max, lang);
  return formatEuro(parsed.min, lang);
}

/** "30–100 €". Empty when the span is not a positive range. */
export function formatPriceSpan(min: number, max: number, lang: EuroLang = "el"): string {
  if (!(min > 0) || !(max > min) || !Number.isFinite(min) || !Number.isFinite(max)) return "";
  return `${amountText(min, lang)}–${amountText(max, lang)} €`;
}
