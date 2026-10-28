export type Lang = "el" | "en";

export type Bilingual = Readonly<{ el: string; en: string }>;

/** Resolve one bilingual string. */
export function bi(lang: Lang, value: Bilingual): string {
  return value[lang];
}

/** Resolve a dictionary of bilingual strings for the active language. */
export function resolveCopy<T extends Record<string, Bilingual>>(
  lang: Lang,
  copy: T
): { [K in keyof T]: string } {
  const result = {} as { [K in keyof T]: string };
  for (const key of Object.keys(copy) as Array<keyof T>) {
    result[key] = copy[key][lang];
  }
  return result;
}
