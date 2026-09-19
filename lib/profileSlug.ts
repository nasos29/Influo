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

export function slugifyProfileName(name: string, fallbackId: string): string {
  const base = toGreeklish(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  if (base && !PROFILE_SLUG_RESERVED.has(base)) return base;
  const short = String(fallbackId).replace(/-/g, '').slice(0, 8);
  return `creator-${short || 'profile'}`;
}

export function normalizeProfileSlug(raw: string): string | null {
  const slug = toGreeklish(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  if (slug.length < 2 || PROFILE_SLUG_RESERVED.has(slug)) return null;
  return slug;
}

export function publicProfilePath(slug?: string | null, influencerId?: string | number): string {
  if (slug) return `/in/${slug}`;
  return `/influencer/${influencerId}`;
}
