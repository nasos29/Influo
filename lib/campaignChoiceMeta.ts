import { formatEuroAmount } from "@/lib/formatEuro";

function calendarUtc(year: number, month: number, day: number): number {
  return Date.UTC(year, month, day);
}

function dayOf(value: string | number): number | null {
  if (typeof value === "number") {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    return calendarUtc(date.getFullYear(), date.getMonth(), date.getDate());
  }
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (dateOnly) return calendarUtc(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return calendarUtc(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Calendar days until the deadline. Null when there is no deadline. */
export function daysUntilClose(deadline: string | null | undefined, now = Date.now()): number | null {
  if (!deadline) return null;
  const end = dayOf(deadline);
  const start = dayOf(now);
  if (end == null || start == null) return null;
  return Math.round((end - start) / 86_400_000);
}

export function closesInLabel(
  deadline: string | null | undefined,
  lang: "el" | "en",
  now = Date.now()
): string | null {
  const days = daysUntilClose(deadline, now);
  if (days == null) return null;
  if (days < 0) return lang === "el" ? "Έληξε" : "Ended";
  if (days === 0) return lang === "el" ? "Κλείνει σήμερα" : "Closes today";
  if (lang === "en") return `Closes in ${days} ${days === 1 ? "day" : "days"}`;
  return `Κλείνει σε ${days} ${days === 1 ? "μέρα" : "μέρες"}`;
}

const STATUS_LABEL: Record<string, { el: string; en: string }> = {
  open: { el: "Ανοιχτή", en: "Open" },
  draft: { el: "Πρόχειρη", en: "Draft" },
  closed: { el: "Κλειστή", en: "Closed" },
};

/** One line under a campaign title: "Ανοιχτή · 50 € · Κλείνει σε 18 μέρες". */
export function campaignChoiceLine(input: {
  status: string;
  budget?: number | string | null;
  deadline?: string | null;
  lang: "el" | "en";
  now?: number;
}): string {
  const lang = input.lang;
  const status = STATUS_LABEL[input.status]?.[lang] || input.status;
  const parts = [status];
  const amount = formatEuroAmount(input.budget, lang);
  const numeric = typeof input.budget === "number" ? input.budget : Number(input.budget);
  if (amount && numeric > 0) parts.push(amount);
  const closes = closesInLabel(input.deadline, lang, input.now);
  if (closes) parts.push(closes);
  return parts.join(" · ");
}
