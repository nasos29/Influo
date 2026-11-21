const ATHENS = "Europe/Athens";

/** YYYY-MM-DD calendar day in Europe/Athens. */
export function athensYmd(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ATHENS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function addCalendarDays(ymd: string, days: number): string {
  const p = parseYmd(ymd);
  if (!p) return ymd;
  const d = new Date(p.y, p.m - 1, p.d);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/** True when today's Athens date is on or after `afterDays` full calendar days after `isoInstant` (Athens date of instant). */
export function athensCalendarDaysElapsed(isoInstant: string, afterDays: number, nowMs: number): boolean {
  const start = athensYmd(new Date(isoInstant));
  const due = addCalendarDays(start, afterDays);
  const today = athensYmd(new Date(nowMs));
  return today >= due;
}