/**
 * Calendar dates shown as dd/mm/yyyy (e.g. 15/11/2026), in Greek and English.
 * Date-only YYYY-MM-DD keeps that civil day. Instants use Europe/Athens.
 * Stored values stay YYYY-MM-DD.
 */

const ATHENS = "Europe/Athens";
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY = /^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/;

export type DateInput = string | number | Date | null | undefined;

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isValidCivilDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

export function ymdFromParts(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function dmyFromParts(year: number, month: number, day: number): string {
  return `${pad2(day)}/${pad2(month)}/${year}`;
}

/** YYYY-MM-DD → dd/mm/yyyy. Anything else → "". */
export function ymdToDmy(ymd: string): string {
  const match = YMD.exec(ymd.trim());
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidCivilDate(year, month, day)) return "";
  return dmyFromParts(year, month, day);
}

/** dd/mm/yyyy (slashes, dots, or dashes; 1- or 2-digit day and month) → YYYY-MM-DD. */
export function dmyToYmd(text: string): string {
  const match = DMY.exec(text.trim());
  if (!match) return "";
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!isValidCivilDate(year, month, day)) return "";
  return ymdFromParts(year, month, day);
}

/** Group typed digits as dd/mm/yyyy while the user is still entering the date. */
export function maskDmyInput(raw: string): string {
  const iso = YMD.exec(raw.trim());
  if (iso) return ymdToDmy(iso[0]);
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  if (digits.length <= 2) return day;
  if (digits.length <= 4) return `${day}/${month}`;
  return `${day}/${month}/${year}`;
}

type AthensParts = { year: number; month: number; day: number; hour: number; minute: number };

function athensParts(date: Date): AthensParts | null {
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ATHENS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const n = (type: string) => {
    const raw = parts.find((part) => part.type === type)?.value ?? "";
    const value = Number(raw);
    return Number.isFinite(value) ? value : NaN;
  };
  const year = n("year");
  const month = n("month");
  const day = n("day");
  let hour = n("hour");
  const minute = n("minute");
  if (!year || !month || !day || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour === 24) hour = 0;
  return { year, month, day, hour, minute };
}

function civilFromValue(value: DateInput): { year: number; month: number; day: number } | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (YMD.test(trimmed)) {
      const [year, month, day] = trimmed.split("-").map(Number);
      if (!isValidCivilDate(year, month, day)) return null;
      return { year, month, day };
    }
    const fromDmy = dmyToYmd(trimmed);
    if (fromDmy) {
      const [year, month, day] = fromDmy.split("-").map(Number);
      return { year, month, day };
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  const parts = athensParts(date);
  if (!parts) return null;
  return parts;
}

/** dd/mm/yyyy, or "" when the value is empty or invalid. */
export function formatDisplayDate(value: DateInput): string {
  const civil = civilFromValue(value);
  if (!civil) return "";
  return dmyFromParts(civil.year, civil.month, civil.day);
}

/** dd/mm/yyyy HH:mm in Europe/Athens. Date-only values stay a date. Empty → "". */
export function formatDisplayDateTime(value: DateInput): string {
  if (value == null || value === "") return "";
  if (typeof value === "string" && YMD.test(value.trim())) return formatDisplayDate(value);
  const date = value instanceof Date ? value : new Date(value as string | number);
  const parts = athensParts(date);
  if (!parts) return "";
  return `${dmyFromParts(parts.year, parts.month, parts.day)} ${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/** 24-hour Europe/Athens clock, or "" for empty, invalid, and date-only values. */
export function formatDisplayTime(value: DateInput): string {
  if (value == null || value === "") return "";
  if (typeof value === "string" && YMD.test(value.trim())) return "";
  const date = value instanceof Date ? value : new Date(value as string | number);
  const parts = athensParts(date);
  if (!parts) return "";
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}
