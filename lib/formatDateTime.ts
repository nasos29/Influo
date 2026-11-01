/** Dates as dd/mm/yyyy and 24-hour Europe/Athens times for dashboards. */

import { formatDisplayDate, formatDisplayDateTime, formatDisplayTime } from "@/lib/formatDate";

export type UiLang = "el" | "en";

export function formatDate(value: string | number | Date | null | undefined, _lang: UiLang): string {
  return formatDisplayDate(value);
}

/** Calendar date and 24-hour time in Europe/Athens. Empty values stay as an em dash. */
export function formatAthensDateTime(value: string | number | Date | null | undefined): string {
  const text = formatDisplayDateTime(value);
  return text || "—";
}

export function formatTime(value: string | number | Date | null | undefined, _lang: UiLang): string {
  return formatDisplayTime(value);
}
