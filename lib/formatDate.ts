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

/**
 * Day 1–31 and month 1–12 while the digits are still being typed.
 * A first digit that cannot start a valid pair (day 4–9, month 2–9) becomes 0X.
 * A second digit outside the range is dropped.
 */
function clampDmyDigits(digits: string): string {
  let i = 0;
  if (i >= digits.length) return "";

  let day = "";
  const d0 = digits[i];
  i += 1;
  if (Number(d0) >= 4) {
    day = `0${d0}`;
  } else {
    day = d0;
    if (i < digits.length) {
      const d1 = digits[i];
      const n = Number(day + d1);
      i += 1;
      if (n >= 1 && n <= 31) day += d1;
    }
  }

  let month = "";
  if (i < digits.length) {
    const m0 = digits[i];
    i += 1;
    if (Number(m0) >= 2) {
      month = `0${m0}`;
    } else {
      month = m0;
      if (i < digits.length) {
        const m1 = digits[i];
        const n = Number(month + m1);
        i += 1;
        if (n >= 1 && n <= 12) month += m1;
      }
    }
  }

  return day + month + digits.slice(i, i + 4);
}

/** True when the field shows a finished dd/mm/yyyy that is not a real calendar day. */
export function isImpossibleDmy(text: string): boolean {
  const trimmed = text.trim();
  return /^\d{2}\/\d{2}\/\d{4}$/.test(trimmed) && !dmyToYmd(trimmed);
}

function groupDmyDigits(digits: string, trailingSlash: boolean): string {
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  if (digits.length <= 2) {
    if (!digits) return "";
    return trailingSlash ? `${day}/` : day;
  }
  if (digits.length <= 4) {
    const body = `${day}/${month}`;
    return trailingSlash ? `${body}/` : body;
  }
  return `${day}/${month}/${year}`;
}

/**
 * Group typed digits as dd/mm/yyyy.
 * A slash is added as soon as the day or the month has two digits, not when the next digit arrives.
 * `previous` is the field value before this keystroke, so backspace can remove a slash
 * without the mask putting it straight back, and a typed slash is not doubled.
 */
export function maskDmyInput(raw: string, previous = ""): string {
  const trimmed = raw.trim();
  const iso = YMD.exec(trimmed);
  if (iso && !trimmed.includes("/")) return ymdToDmy(iso[0]);

  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const prevDigits = previous.replace(/\D/g, "").slice(0, 8);
  const deleting = raw.length < previous.length;
  const removedOnlySeparator = deleting && digits === prevDigits;
  const typedEarlySlash = !deleting && raw.endsWith("/") && (digits.length === 1 || digits.length === 3);
  const clamped = clampDmyDigits(digits);
  const trailingSlash =
    !removedOnlySeparator &&
    clamped.length > 0 &&
    clamped.length < 5 &&
    (clamped.length === 2 || clamped.length === 4 || typedEarlySlash);

  return groupDmyDigits(clamped, trailingSlash);
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
