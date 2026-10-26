/**
 * Greek to Greeklish (Latin) transliteration
 * Used for displaying influencer names in the English version
 */

const GREEK_TO_LATIN: Record<string, string> = {
  // Lowercase (base letters)
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th',
  ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p',
  ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
  // Lowercase with tonos (ά έ ή ί ό ύ ώ) - no accents in Greeklish
  ά: 'a', έ: 'e', ή: 'i', ί: 'i', ό: 'o', ύ: 'y', ώ: 'o',
  // Lowercase with dialytika (ϊ ϋ)
  ϊ: 'i', ϋ: 'y',
  // Lowercase with dialytika + tonos (ΐ ΰ)
  ΐ: 'i', ΰ: 'y',
  // Uppercase (base letters)
  Α: 'A', Β: 'V', Γ: 'G', Δ: 'D', Ε: 'E', Ζ: 'Z', Η: 'I', Θ: 'Th',
  Ι: 'I', Κ: 'K', Λ: 'L', Μ: 'M', Ν: 'N', Ξ: 'X', Ο: 'O', Π: 'P',
  Ρ: 'R', Σ: 'S', Τ: 'T', Υ: 'Y', Φ: 'F', Χ: 'Ch', Ψ: 'Ps', Ω: 'O',
  // Uppercase with tonos
  Ά: 'A', Έ: 'E', Ή: 'I', Ί: 'I', Ό: 'O', Ύ: 'Y', Ώ: 'O',
};

/**
 * Checks if a string contains Greek characters
 */
export function hasGreekChars(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return /[\u0370-\u03FF]/.test(text); // Greek Unicode block
}

/**
 * Transliterates Greek text to Greeklish (Latin), letter-by-letter.
 * Used for profile slugs / URLs — do not change digraph behaviour here.
 * If text has no Greek chars, returns as-is.
 */
export function toGreeklish(text: string): string {
  if (!text || typeof text !== 'string') return text || '';
  return text.split('').map((char) => GREEK_TO_LATIN[char] ?? char).join('');
}

const DIALYTIKA_RE = /[ϊϋΐΰΪΫ]/u;

/** Bare vowel/consonant for digraph matching (strips tonos + dialytika). */
function bareGreek(ch: string): string {
  const lo = ch.toLocaleLowerCase('el');
  const strip: Record<string, string> = {
    ά: 'α',
    έ: 'ε',
    ή: 'η',
    ί: 'ι',
    ό: 'ο',
    ύ: 'υ',
    ώ: 'ω',
    ϊ: 'ι',
    ϋ: 'υ',
    ΐ: 'ι',
    ΰ: 'υ',
  };
  return strip[lo] ?? lo;
}

function hasDialytika(ch: string): boolean {
  return DIALYTIKA_RE.test(ch);
}

function isGreekChar(ch: string): boolean {
  return /[\u0370-\u03FF]/.test(ch);
}

function isUpperGreekForm(ch: string): boolean {
  return ch !== ch.toLocaleLowerCase('el');
}

function isNameWordStart(chars: string[], index: number): boolean {
  if (index <= 0) return true;
  const prev = chars[index - 1] ?? '';
  return /[\s\-_/]/.test(prev);
}

/** αυ/ευ → f before unvoiced consonants. */
const AV_EU_F_BEFORE = new Set(['θ', 'κ', 'ξ', 'π', 'σ', 'ς', 'τ', 'φ', 'χ', 'ψ']);

function caseLatinDigraph(latin: string, firstUpper: boolean, allUpper: boolean): string {
  if (!latin) return latin;
  if (allUpper) return latin.toUpperCase();
  if (firstUpper) return latin.charAt(0).toUpperCase() + latin.slice(1).toLowerCase();
  return latin.toLowerCase();
}

/**
 * Display-only Greek→Latin for names (digraph-aware).
 * Do not use for slugs — keep {@link toGreeklish} for URLs.
 */
export function toGreeklishName(text: string): string {
  if (!text || typeof text !== 'string') return text || '';
  if (!hasGreekChars(text)) return text;

  const chars = [...text];
  let out = '';
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i]!;

    if (!isGreekChar(ch)) {
      out += ch;
      i += 1;
      continue;
    }

    const next = chars[i + 1];
    const canDigraph =
      !!next &&
      isGreekChar(next) &&
      !hasDialytika(ch) &&
      !hasDialytika(next);

    if (canDigraph) {
      const b0 = bareGreek(ch);
      const b1 = bareGreek(next!);
      const pair = `${b0}${b1}`;
      const firstUpper = isUpperGreekForm(ch);
      const allUpper = firstUpper && isUpperGreekForm(next!);
      const wordStart = isNameWordStart(chars, i);
      const afterBare = chars[i + 2] && isGreekChar(chars[i + 2]!) ? bareGreek(chars[i + 2]!) : '';

      let latin: string | null = null;
      if (pair === 'ου') latin = 'ou';
      else if (pair === 'αι') latin = 'ai';
      else if (pair === 'ει') latin = 'ei';
      else if (pair === 'οι') latin = 'oi';
      else if (pair === 'αυ') latin = AV_EU_F_BEFORE.has(afterBare) ? 'af' : 'av';
      else if (pair === 'ευ') latin = AV_EU_F_BEFORE.has(afterBare) ? 'ef' : 'ev';
      else if (pair === 'μπ') latin = wordStart ? 'b' : 'mp';
      else if (pair === 'ντ') latin = wordStart ? 'd' : 'nt';
      else if (pair === 'γκ') latin = wordStart ? 'g' : 'gk';
      else if (pair === 'γγ') latin = 'ng';
      else if (pair === 'τσ') latin = 'ts';
      else if (pair === 'τζ') latin = 'tz';

      if (latin) {
        out += caseLatinDigraph(latin, firstUpper, allUpper);
        i += 2;
        continue;
      }
    }

    out += GREEK_TO_LATIN[ch] ?? ch;
    i += 1;
  }

  return out;
}

const LETTER_RE = /\p{L}/u;

function isLetter(ch: string): boolean {
  return LETTER_RE.test(ch);
}

/** Handles / usernames / domains — leave untouched. */
function isHandleLike(word: string): boolean {
  return /[@_\d.]/.test(word);
}

/** Short Latin acronyms like DJ, CEO — leave uppercase. */
function isShortLatinAcronym(word: string): boolean {
  return /^[A-Z]{2,3}$/.test(word);
}

function lettersOf(word: string): string[] {
  return [...word].filter(isLetter);
}

/** True when lowercasing the word changes nothing (all lowercase / caseless). */
function isAllLowerLetters(word: string): boolean {
  const letters = lettersOf(word);
  return letters.length > 0 && word === word.toLocaleLowerCase('el');
}

/**
 * True when every letter is an uppercase form (incl. Greek capitals with tonos like Ί,
 * where toLocaleUpperCase('el') strips the tonos to Ι).
 */
function isAllUpperLetters(word: string): boolean {
  const letters = lettersOf(word);
  if (!letters.length) return false;
  if (word === word.toLocaleLowerCase('el')) return false;
  // A lowercase letter equals its toLocaleLowerCase form; uppercase (with or without tonos) does not.
  return letters.every((ch) => ch !== ch.toLocaleLowerCase('el'));
}

function hasMixedCase(word: string): boolean {
  const letters = lettersOf(word);
  if (letters.length < 2) return false;
  let hasUpper = false;
  let hasLower = false;
  for (const ch of letters) {
    const lo = ch.toLocaleLowerCase('el');
    const up = ch.toLocaleUpperCase('el');
    if (lo === up) continue;
    if (ch === lo) hasLower = true;
    else hasUpper = true; // uppercase form, including Ί (Ί !== ί)
  }
  return hasUpper && hasLower;
}

function applyFinalSigma(word: string): string {
  if (!word) return word;
  if (word.endsWith('σ')) return `${word.slice(0, -1)}ς`;
  return word;
}

/** Title-case one segment (no hyphens): first letter upper, rest lower (el locale). */
function titleCaseSegment(segment: string): string {
  if (!segment) return segment;
  const lower = segment.toLocaleLowerCase('el');
  let i = 0;
  while (i < lower.length && !isLetter(lower[i]!)) i += 1;
  if (i >= lower.length) return applyFinalSigma(lower);
  const first = lower[i]!.toLocaleUpperCase('el');
  const result = `${lower.slice(0, i)}${first}${lower.slice(i + 1)}`;
  return applyFinalSigma(result);
}

/**
 * Normalize one space-separated token (may contain hyphens).
 * Handle-like and mixed-case parts are left unchanged.
 */
function normalizeToken(token: string): string {
  if (!token) return token;
  if (isHandleLike(token)) return token;
  return token
    .split('-')
    .map((part) => {
      if (!part) return part;
      if (isHandleLike(part)) return part;
      if (isShortLatinAcronym(part)) return part;
      if (hasMixedCase(part)) return part;
      if (isAllUpperLetters(part) || isAllLowerLetters(part)) return titleCaseSegment(part);
      return part;
    })
    .join('-');
}

/**
 * Display-only name casing: ALL CAPS / all lowercase words → Title Case.
 * Mixed case (McDonald), handles (maria_style), and short acronyms (DJ) stay as stored.
 * Does not invent accents; keeps existing ones. Does not write to the DB.
 */
export function normalizeNameCase(name: string | null | undefined): string {
  if (name == null) return '';
  const raw = String(name);
  if (!raw.trim()) return raw;
  return raw
    .trim()
    .split(/\s+/)
    .map(normalizeToken)
    .join(' ');
}

/**
 * Returns the appropriate display name: normalize case first, then digraph-aware
 * Greeklish when lang is 'en' (not letter-by-letter {@link toGreeklish}, which is for slugs).
 */
export function displayNameForLang(name: string | null | undefined, lang: 'el' | 'en'): string {
  const n = normalizeNameCase(name ?? '');
  if (lang === 'en' && hasGreekChars(n)) {
    return toGreeklishName(n);
  }
  return n;
}
