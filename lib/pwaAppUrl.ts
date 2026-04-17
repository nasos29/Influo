/** Canonical site origin (no trailing slash). Safe on server + client. */
export function getSiteUrl(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  return u && u.length > 0 ? u : "https://influo.gr";
}

/** Path to install / get-app landing (PWA). */
export function getAppInstallPath(lang: "el" | "en"): string {
  return lang === "en" ? "/en/get-app" : "/get-app";
}

export function getAppInstallAbsoluteUrl(lang: "el" | "en", utm?: string): string {
  const base = getSiteUrl();
  const path = getAppInstallPath(lang);
  const q = utm ? `?${utm}` : "";
  return `${base}${path}${q}`;
}
