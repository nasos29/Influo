/** Canonical influencer language options (stored as Greek labels). */

export const INFLUENCER_LANGUAGES = [
  { code: 'el', el: 'Ελληνικά', en: 'Greek' },
  { code: 'en', el: 'Αγγλικά', en: 'English' },
  { code: 'de', el: 'Γερμανικά', en: 'German' },
  { code: 'fr', el: 'Γαλλικά', en: 'French' },
  { code: 'es', el: 'Ισπανικά', en: 'Spanish' },
  { code: 'it', el: 'Ιταλικά', en: 'Italian' },
  { code: 'pt', el: 'Πορτογαλικά', en: 'Portuguese' },
  { code: 'ru', el: 'Ρωσικά', en: 'Russian' },
  { code: 'zh', el: 'Κινεζικά', en: 'Chinese' },
  { code: 'ja', el: 'Ιαπωνικά', en: 'Japanese' },
  { code: 'sq', el: 'Αλβανικά', en: 'Albanian' },
  { code: 'bg', el: 'Βουλγαρικά', en: 'Bulgarian' },
  { code: 'tr', el: 'Τουρκικά', en: 'Turkish' },
] as const;

/** Map UI codes → Greek labels for DB storage (same format as profile edit). */
export function languagesCodesToStored(codes: string[]): string {
  return codes
    .map((code) => {
      const row = INFLUENCER_LANGUAGES.find((l) => l.code === code);
      return row ? row.el : code;
    })
    .filter(Boolean)
    .join(', ');
}

/** Display label for a stored value that may be a code (el) or Greek/English name. */
export function displayLanguageLabel(raw: string, lang: 'el' | 'en' = 'el'): string {
  const key = String(raw || '').trim();
  if (!key) return '';
  const byCode = INFLUENCER_LANGUAGES.find((l) => l.code === key.toLowerCase());
  if (byCode) return lang === 'el' ? byCode.el : byCode.en;
  const byEl = INFLUENCER_LANGUAGES.find((l) => l.el === key);
  if (byEl) return lang === 'el' ? byEl.el : byEl.en;
  const byEn = INFLUENCER_LANGUAGES.find(
    (l) => l.en.toLowerCase() === key.toLowerCase()
  );
  if (byEn) return lang === 'el' ? byEn.el : byEn.en;
  return key;
}
