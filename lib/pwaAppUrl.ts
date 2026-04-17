/**
 * Canonical public origin for QR codes and install links.
 * NEXT_PUBLIC_QR_SITE_URL overrides (e.g. https://www.influo.gr) when SITE_URL is wrong in some environments.
 */

const DEFAULT_PUBLIC = "https://influo.gr";

function stripTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

/**
 * Safe https origin for marketing / QR (never localhost — phones cannot reach dev URLs).
 */
export function resolvePublicBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_QR_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "";

  if (!raw) return DEFAULT_PUBLIC;

  let candidate = raw.replace(/\s+/g, "");
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const u = new URL(candidate);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.endsWith(".local")) {
      return DEFAULT_PUBLIC;
    }
    if (u.protocol === "http:") {
      u.protocol = "https:";
    }
    return stripTrailingSlashes(u.origin);
  } catch {
    return DEFAULT_PUBLIC;
  }
}

/** @deprecated Prefer resolvePublicBaseUrl — kept for GetAppLanding SSR hint */
export function getSiteUrl(): string {
  return resolvePublicBaseUrl();
}

export function getAppInstallPath(lang: "el" | "en"): string {
  return lang === "en" ? "/en/get-app" : "/get-app";
}

export function getAppInstallAbsoluteUrl(lang: "el" | "en", utm?: string): string {
  const base = resolvePublicBaseUrl();
  const path = getAppInstallPath(lang);
  const q = utm ? `?${utm}` : "";
  return `${base}${path}${q}`;
}

/** Same path/query but with explicit origin (e.g. current browser origin on production). */
export function buildAppInstallUrl(baseOrigin: string, lang: "el" | "en", utm?: string): string {
  const base = stripTrailingSlashes(baseOrigin.replace(/\s+/g, ""));
  const path = getAppInstallPath(lang);
  const q = utm ? `?${utm}` : "";
  return `${base}${path}${q}`;
}
