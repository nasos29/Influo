import { toGreeklish } from '@/lib/greeklish';

export const PROFILE_SLUG_RESERVED = new Set([
  'about',
  'admin',
  'api',
  'blog',
  'brand',
  'brands',
  'campaigns',
  'contact',
  'cookies',
  'dashboard',
  'directory',
  'docs',
  'en',
  'faq',
  'for-brands',
  'for-influencers',
  'get-app',
  'help-desk',
  'in',
  'influencer',
  'login',
  'logout',
  'messages',
  'privacy',
  'reset-password',
  'signup',
  'terms',
  'u',
  'www',
]);

function cleanSlug(raw: string): string {
  return toGreeklish(raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/^-+|-+$/g, "");
}

export function slugifyProfileName(name: string, fallbackId: string): string {
  const base = cleanSlug(name);
  if (base.length >= 2 && !PROFILE_SLUG_RESERVED.has(base)) return base;
  const short = String(fallbackId).replace(/-/g, "").slice(0, 8);
  return `creator-${short || "profile"}`;
}

export function normalizeProfileSlug(raw: string): string | null {
  const slug = cleanSlug(raw);
  if (slug.length < 2 || PROFILE_SLUG_RESERVED.has(slug)) return null;
  return slug;
}

export function publicProfilePath(slug?: string | null, influencerId?: string | number): string {
  if (slug) return `/in/${slug}`;
  return `/influencer/${influencerId}`;
}

/**
 * Absolute profile URL meant to open in the system browser, not the installed PWA.
 * Same-origin `/in/...` links from standalone stay inside the app; using the other
 * host (influo.gr ↔ www.influo.gr) leaves the PWA, then nginx 308s to www in the browser.
 */
export function publicProfileBrowserUrl(
  slug?: string | null,
  influencerId?: string | number,
  currentHost?: string | null
): string {
  const path = publicProfilePath(slug, influencerId);
  const host = (currentHost || (typeof window !== "undefined" ? window.location.hostname : "") || "")
    .toLowerCase()
    .trim();
  if (host === "www.influo.gr") return `https://influo.gr${path}`;
  if (host === "influo.gr") return `https://www.influo.gr${path}`;
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `https://${host}${path}`;
  }
  return `https://influo.gr${path}`;
}
