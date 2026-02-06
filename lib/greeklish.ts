/**
 * Greek to Greeklish (Latin) transliteration
 * Used for displaying influencer names in the English version
 */

const GREEK_TO_LATIN: Record<string, string> = {
  // Lowercase
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th',
  ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p',
  ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
  // Uppercase
  Α: 'A', Β: 'V', Γ: 'G', Δ: 'D', Ε: 'E', Ζ: 'Z', Η: 'I', Θ: 'Th',
  Ι: 'I', Κ: 'K', Λ: 'L', Μ: 'M', Ν: 'N', Ξ: 'X', Ο: 'O', Π: 'P',
  Ρ: 'R', Σ: 'S', Τ: 'T', Υ: 'Y', Φ: 'F', Χ: 'Ch', Ψ: 'Ps', Ω: 'O',
};

/**
 * Checks if a string contains Greek characters
 */
export function hasGreekChars(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return /[\u0370-\u03FF]/.test(text); // Greek Unicode block
}

/**
 * Transliterates Greek text to Greeklish (Latin)
 * If text has no Greek chars, returns as-is
 */
export function toGreeklish(text: string): string {
  if (!text || typeof text !== 'string') return text || '';
  return text.split('').map((char) => GREEK_TO_LATIN[char] ?? char).join('');
}

/**
 * Returns the appropriate display name: Greeklish when lang is 'en' and text has Greek, else original
 */
export function displayNameForLang(name: string | null | undefined, lang: 'el' | 'en'): string {
  const n = name ?? '';
  if (lang === 'en' && hasGreekChars(n)) {
    return toGreeklish(n);
  }
  return n;
}
