/** Canonical origin. Every public URL uses www. Non-www is a Vercel-domain redirect. */
export const SITE_URL = "https://www.influo.gr";

export const SITE_NAME = "Influo.gr";

/** Footer profiles. Not the placeholder instagram.com/influo links. */
export const ORGANIZATION_SAME_AS = [
  "https://www.instagram.com/influo.gr/",
  "https://www.facebook.com/profile.php?id=61585893435769",
  "https://www.tiktok.com/@influo.gr",
  "https://www.linkedin.com/company/influo-gr/",
];

/**
 * Public support address already used in the product (docs, tickets, footer).
 * contact@influo.gr is not in the codebase, so it is not used here.
 */
export const ORGANIZATION_EMAIL = "support@influo.gr";

export function absoluteUrl(path: string): string {
  if (!path || path === "/") return `${SITE_URL}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

/** Greek URL is x-default. Pass enPath only when an English page exists. */
export function languageAlternates(elPath: string, enPath?: string): Record<string, string> {
  const languages: Record<string, string> = {
    el: elPath,
    "x-default": elPath,
  };
  if (enPath) languages.en = enPath;
  return languages;
}
