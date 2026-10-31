/** Locale dates and 24-hour times for dashboards. el-GR / en-GB. */

export type UiLang = "el" | "en";

function localeFor(lang: UiLang): string {
  return lang === "el" ? "el-GR" : "en-GB";
}

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) {
      const date = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | number | Date | null | undefined, lang: UiLang): string {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString(localeFor(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(value: string | number | Date | null | undefined, lang: UiLang): string {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleTimeString(localeFor(lang), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
