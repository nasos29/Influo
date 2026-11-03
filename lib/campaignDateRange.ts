/** Allowed campaign dates: from today (Athens) up to today + 2 years. YYYY-MM-DD strings. */
export function campaignDateBounds(now: Date = new Date()): { min: string; max: string } {
  const fmt = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Athens" });
  const max = new Date(now);
  max.setFullYear(max.getFullYear() + 2);
  return { min: fmt(now), max: fmt(max) };
}

export const DATE_RANGE_MSG = {
  el: "Η ημερομηνία πρέπει να είναι μέσα στα επόμενα 2 χρόνια.",
  en: "The date must be within the next 2 years.",
} as const;
