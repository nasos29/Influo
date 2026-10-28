/**
 * Birth-date rules for influencer signup / profile edits.
 * Age uses Europe/Athens calendar days (same as ageFromBirthDate).
 */

import { ageFromBirthDate } from '@/lib/publicInfluencer';

export const BIRTH_DATE_MIN = '1930-01-01';
export const MIN_INFLUENCER_AGE = 15;

export const BIRTH_DATE_RANGE_MESSAGE = {
  el: 'Η ημερομηνία γέννησης πρέπει να είναι μεταξύ 1930 και σήμερα.',
  en: 'Date of birth must be between 1930 and today.',
} as const;

export const BIRTH_DATE_TOO_YOUNG_MESSAGE = {
  el: 'Πρέπει να είσαι τουλάχιστον 15 ετών για να εγγραφείς στο Influo.',
  en: 'You must be at least 15 years old to sign up to Influo.',
} as const;

const ATHENS = 'Europe/Athens';

export type BirthDateLang = 'el' | 'en';

export type BirthDateOk = {
  ok: true;
  /** YYYY-MM-DD */
  normalized: string;
  age: number;
};

export type BirthDateErr = {
  ok: false;
  code: 'invalid' | 'out_of_range' | 'too_young';
  message: { el: string; en: string };
};

export type BirthDateResult = BirthDateOk | BirthDateErr;

function zonedYmd(date: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ATHENS,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const n = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { y: n('year'), m: n('month'), d: n('day') };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function ymdToIso(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** Today's calendar date in Europe/Athens as YYYY-MM-DD (for <input type="date" max>). */
export function athensTodayYmd(now = new Date()): string {
  const { y, m, d } = zonedYmd(now);
  return ymdToIso(y, m, d);
}

/** Parse a calendar YYYY-MM-DD (or Date) into Y/M/D without shifting the civil day. */
function parseCivilYmd(raw: unknown): { y: number; m: number; d: number; iso: string } | null {
  if (raw == null || raw === '') return null;

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    const { y, m, d } = zonedYmd(raw);
    if (!y || !m || !d) return null;
    return { y, m, d, iso: ymdToIso(y, m, d) };
  }

  const text = String(raw).trim();
  if (!text) return null;

  // Prefer explicit calendar date (HTML date inputs).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
    // Reject impossible calendar days (e.g. 2024-02-30).
    const probe = new Date(Date.UTC(y, mo - 1, d));
    if (
      probe.getUTCFullYear() !== y ||
      probe.getUTCMonth() !== mo - 1 ||
      probe.getUTCDate() !== d
    ) {
      return null;
    }
    return { y, m: mo, d, iso: ymdToIso(y, mo, d) };
  }

  const dt = new Date(text);
  if (Number.isNaN(dt.getTime())) return null;
  const z = zonedYmd(dt);
  if (!z.y || !z.m || !z.d) return null;
  return { y: z.y, m: z.m, d: z.d, iso: ymdToIso(z.y, z.m, z.d) };
}

function cmpIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Validate an influencer birth date.
 * - Must parse as a real calendar day
 * - Inclusive range: 1930-01-01 … today (Athens)
 * - Age must be >= 15 (Athens), same rules as ageFromBirthDate
 */
export function validateBirthDate(raw: unknown, now = new Date()): BirthDateResult {
  const parsed = parseCivilYmd(raw);
  if (!parsed) {
    return {
      ok: false,
      code: 'invalid',
      message: {
        el: 'Η ημερομηνία γέννησης δεν είναι έγκυρη.',
        en: 'The date of birth is not valid.',
      },
    };
  }

  const today = athensTodayYmd(now);
  if (cmpIso(parsed.iso, BIRTH_DATE_MIN) < 0 || cmpIso(parsed.iso, today) > 0) {
    return { ok: false, code: 'out_of_range', message: { ...BIRTH_DATE_RANGE_MESSAGE } };
  }

  const age = ageFromBirthDate(parsed.iso, now);
  if (age == null || age < MIN_INFLUENCER_AGE) {
    return { ok: false, code: 'too_young', message: { ...BIRTH_DATE_TOO_YOUNG_MESSAGE } };
  }

  return { ok: true, normalized: parsed.iso, age };
}

/** Pick el/en copy from a validation error (default el). */
export function birthDateErrorText(
  result: BirthDateErr,
  lang: BirthDateLang = 'el'
): string {
  return result.message[lang] || result.message.el;
}

/** Accept-Language → el|en for API 400 bodies. */
export function birthDateLangFromRequest(request: { headers: Headers }): BirthDateLang {
  const raw = (request.headers.get('accept-language') || '').toLowerCase();
  if (raw.startsWith('en')) return 'en';
  return 'el';
}
