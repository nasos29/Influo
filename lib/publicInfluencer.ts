/**
 * Explicit allow-lists for influencer data that can leave the server
 * without a logged-in brand session.
 *
 * Raw rate cards, contact email, birth date, and auth ids are never copied
 * here. Guests get `from_price` (the cheapest service, or min_rate) and each
 * public package's own `from_price`. Callers must not spread the raw database
 * row into a response.
 */

import { formatEuro } from "@/lib/formatEuro";
import { sanitizeTopPosts } from "@/lib/topPosts";
import { visibleVideos } from "@/lib/hiddenVideos";
import {
  RATE_CARD_PRICE_KEYS,
  commercialExtrasFromRateCard,
  listedPriceAmount,
  minRateFromPackages,
  publicExtrasFromRateCard,
  resolvePackagesForDisplay,
  toCommercialPackageView,
  toPublicPackageView,
  type PublicExtraView,
  type PublicPackageView,
} from "@/lib/servicePackages";

export const DIRECTORY_CARD_COLUMNS = [
  "id",
  "display_name",
  "bio",
  "bio_en",
  "avatar_url",
  "analytics_verified",
  "verified",
  "accounts",
  "category",
  "languages",
  "gender",
  "location",
  "avg_likes",
  "engagement_rate",
  "avg_rating",
  "total_reviews",
  "created_at",
  "availability_status",
  "profile_slug",
] as const;

/** Extra columns the public profile page renders for logged-out visitors. */
export const PUBLIC_PROFILE_EXTRA_COLUMNS = [
  "videos",
  "hidden_videos",
  "video_thumbnails",
  "skills",
  "certifications",
  "audience_male_percent",
  "audience_female_percent",
  "audience_top_age",
  "auditpr_audit",
  "avg_response_time",
  "completion_rate",
] as const;

/** Read server-side only so the public payload can say "a price exists" without the amount. */
export const PRICING_SOURCE_COLUMNS = ["min_rate", "rate_card", "service_packages"] as const;

export const NEWLY_APPROVED_EXTRA_COLUMNS = ["videos", "hidden_videos", "video_thumbnails"] as const;

const ACCOUNT_KEYS = [
  "platform",
  "username",
  "followers",
  "engagement_rate",
  "avg_likes",
  "posts_count",
  "avg_views",
  "is_private",
  "er_suspicious",
  "er_flag_reason",
  "engagement_hidden",
  "suspected_fake_penalty",
  "engagement_rate_raw",
  "fake_follower_percent",
  "suspected_fake_percent",
  "fake_followers_percent",
  "quality_penalty_percent",
  "er_penalty_percent",
  "penalty_percent",
  "top_posts",
  "channel_id",
  "channel_handle",
] as const;

const AUDIT_KEYS = [
  "scoreBreakdown",
  "scoreBreakdown_en",
  "whyWorkWithThem",
  "whyWorkWithThem_en",
  "positives",
  "positives_en",
  "negatives",
  "negatives_en",
  "brandSafe",
  "niche",
  "niche_en",
] as const;

const RATE_CARD_KEYS = RATE_CARD_PRICE_KEYS;

export type RateCardFlags = Partial<Record<(typeof RATE_CARD_KEYS)[number], boolean>>;

/** @deprecated Prefer PublicPackageView from servicePackages. */
export type PublicServicePackage = PublicPackageView;

const BLOCKED_KEYS = new Set([
  "contact_email",
  "email",
  "birth_date",
  "auth_user_id",
  "min_rate",
  "rate_card",
  "service_packages",
  "approval_notes",
  "analytics_verification_notes",
  "approved_at",
  "analytics_verified_at",
  "brands_notified_at",
  "last_social_refresh_at",
  "phone",
  "password",
  "token",
  "access_token",
  "refresh_token",
]);

export function isConcretePrice(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(ask|ρώτησε|ρωτησε)$/i.test(trimmed)) return false;
  return true;
}

/**
 * Budget dropdown values in the public directory, in the same order.
 * Tiers are these caps so "up to X" and "5000+" keep the same matches
 * without sending the exact min_rate.
 */
export const DIRECTORY_BUDGET_CAPS = [50, 100, 200, 300, 500, 1000, 2000, 5000] as const;

export type PriceTier =
  | "0"
  | "50"
  | "100"
  | "200"
  | "300"
  | "500"
  | "1000"
  | "2000"
  | "under_5000"
  | "5000"
  | "above_5000";

/** Same parsing as Directory's parsePrice (non-digits except '.' removed). */
export function parseDirectoryPrice(price: unknown): number {
  if (price == null || price === "") return 0;
  const raw = typeof price === "number" ? String(price) : typeof price === "string" ? price : "";
  if (!raw) return 0;
  const parsed = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return parsed || 0;
}

/**
 * Half-open buckets: a price equal to a cap belongs to that cap's "from" scale,
 * not the previous one. 49 → "50" (up to 50), 50 and 80 → "100" (from 50),
 * 100 and 150 → "200" (from 100), 200 → "300" (from 200). 5000+ stays VIP.
 */
export function priceTierFromMinRate(minRate: unknown): PriceTier {
  const rate = parseDirectoryPrice(minRate);
  if (!(rate > 0)) return "0";
  for (const cap of DIRECTORY_BUDGET_CAPS) {
    if (cap === 5000) break;
    if (rate < cap) return String(cap) as PriceTier;
  }
  if (rate < 5000) return "under_5000";
  if (rate === 5000) return "5000";
  return "above_5000";
}

/**
 * Directory "up to X" filter. Tiers below 5000 are half-open, so "up to X"
 * includes tiers whose exclusive ceiling is <= X (every price in them is < X).
 * A price exactly on a cap sits in the next tier and shows up from the next cap.
 * 5000 and above stay on the VIP tiers.
 */
export function budgetTierMatches(tier: string | null | undefined, budgetMax: string): boolean {
  if (!budgetMax || budgetMax === "All") return true;
  const value = tier || "0";
  if (budgetMax === "Unlimited") return value === "5000" || value === "above_5000";
  const max = parseInt(budgetMax, 10);
  if (!Number.isFinite(max)) return true;
  if (value === "above_5000") return false;
  if (value === "0") return true;
  if (value === "under_5000" || value === "5000") return max >= 5000;
  const ceiling = parseInt(value, 10);
  if (!Number.isFinite(ceiling)) return true;
  return ceiling <= max;
}

/** Lets the VIP badge (min rate >= 5000) stay correct without the real amount. */
export function badgeMinRateFromTier(tier: string | null | undefined): string | undefined {
  if (tier === "5000" || tier === "above_5000") return "5000";
  return undefined;
}

/**
 * Legacy range copy from a ceiling tier. Guest UI uses `formatFromPriceLabel`.
 * "0" → null; "50" → "έως 50 €" (prices under 50).
 * Numeric tiers are half-open up to that cap; 5000+ stays "5.000 €+".
 */
export function formatPriceTierLabel(tier: string | null | undefined): string | null {
  const value = (tier || "0").trim();
  if (!value || value === "0") return null;
  if (value === "50") return `έως ${formatEuro(50)}`;
  if (value === "under_5000") return `${formatEuro(2000)}–${formatEuro(5000)}`;
  if (value === "5000" || value === "above_5000") return `${formatEuro(5000)}+`;

  const ceiling = parseInt(value, 10);
  if (!Number.isFinite(ceiling)) return null;
  const idx = DIRECTORY_BUDGET_CAPS.indexOf(ceiling as (typeof DIRECTORY_BUDGET_CAPS)[number]);
  if (idx <= 0) return formatEuro(ceiling);
  const prev = DIRECTORY_BUDGET_CAPS[idx - 1]!;
  return `${formatEuro(prev)}–${formatEuro(ceiling)}`;
}

/**
 * Guest label for an exact amount: «Από 40 €» / «From 40 €».
 * The euro sign stays to the right of the amount, with a space.
 * Never produces «Από έως» / «From up to».
 */
export function formatFromPriceLabel(
  amount: unknown,
  lang: "el" | "en" = "el"
): string | null {
  const n = parseDirectoryPrice(amount);
  if (!(n > 0)) return null;
  const formatted = formatEuro(n, lang);
  if (!formatted) return null;
  return lang === "en" ? `From ${formatted}` : `Από ${formatted}`;
}

/**
 * Cheapest positive price on rate_card / service_packages
 * (same path as `resolvePackagesForDisplay` + `minRateFromPackages`).
 * When that list is empty, falls back to `min_rate`.
 */
export function lowestListedPrice(row: {
  service_packages?: unknown;
  rate_card?: unknown;
  min_rate?: unknown;
}): number | null {
  const fromPackages = minRateFromPackages(
    resolvePackagesForDisplay(row.service_packages, row.rate_card)
  );
  const fromList = listedPriceAmount(fromPackages);
  if (fromList != null) return fromList;
  const fallback = parseDirectoryPrice(row.min_rate);
  return fallback > 0 ? fallback : null;
}

const ATHENS = "Europe/Athens";

function zonedYmd(date: Date, timeZone: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const n = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { y: n("year"), m: n("month"), d: n("day") };
}

/**
 * Whole years, same calendar rules as the directory used to run in the browser,
 * evaluated in Europe/Athens so Greek visitors get the same age they had before.
 * The raw birth date is not returned.
 */
export function ageFromBirthDate(birthDate: unknown, now = new Date()): number | null {
  if (birthDate == null || birthDate === "") return null;
  const birth = birthDate instanceof Date ? birthDate : new Date(String(birthDate));
  if (Number.isNaN(birth.getTime())) return null;
  const born = zonedYmd(birth, ATHENS);
  const today = zonedYmd(now, ATHENS);
  if (!born.y || !born.m || !born.d || !today.y) return null;
  let age = today.y - born.y;
  if (today.m < born.m || (today.m === born.m && today.d < born.d)) age--;
  return age;
}

/** True when min_rate is non-empty, so the profile still shows the locked price card. */
export function hasListedMinRate(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  return value.trim().length > 0;
}

/**
 * Same rule as parseMoney() in channelScore.ts (coop score +0.7).
 * Kept here so this module stays free of server imports.
 */
export function hasPricedMinRate(value: unknown): boolean {
  if (value == null || value === "") return false;
  const text = String(value).trim();
  if (!text || /ρώτησε|ask/i.test(text)) return false;
  const amount = parseFloat(text.replace(/[^\d.,]/g, "").replace(",", "."));
  return Number.isFinite(amount) && amount > 0;
}

function pickColumns(row: Record<string, unknown>, columns: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of columns) {
    if (BLOCKED_KEYS.has(key)) continue;
    if (key === "accounts") {
      out.accounts = sanitizeAccounts(row.accounts);
      continue;
    }
    if (key === "auditpr_audit") {
      out.auditpr_audit = sanitizeAudit(row.auditpr_audit);
      continue;
    }
    if (row[key] !== undefined) out[key] = row[key];
  }
  return out;
}

function sanitizeAccounts(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const src = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const acc: Record<string, unknown> = {};
    for (const key of ACCOUNT_KEYS) {
      if (src[key] === undefined) continue;
      if (key === "top_posts") {
        acc.top_posts = sanitizeTopPosts(src.top_posts);
        continue;
      }
      acc[key] = src[key];
    }
    return acc;
  });
}

function sanitizeAudit(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of AUDIT_KEYS) {
    if (src[key] !== undefined) out[key] = src[key];
  }
  return out;
}

export function rateCardFlags(raw: unknown): RateCardFlags {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const flags: RateCardFlags = {};
  for (const key of RATE_CARD_KEYS) {
    if (isConcretePrice(src[key])) flags[key] = true;
  }
  return flags;
}

/** Public packages: no exact prices. Falls back to rate_card for display only. */
export function publicServicePackages(
  raw: unknown,
  rateCard?: unknown,
  lang: "el" | "en" = "en"
): PublicPackageView[] {
  return resolvePackagesForDisplay(raw, rateCard).map((pkg) =>
    toPublicPackageView(pkg, lang, priceTierFromMinRate)
  );
}

function withFilterFields(base: Record<string, unknown>, row: Record<string, unknown>, includeAge: boolean) {
  const fromPrice = lowestListedPrice(row);
  base.from_price = fromPrice;
  // Budget filters still use the ceiling tier. The guest label uses from_price.
  base.price_tier = priceTierFromMinRate(fromPrice ?? row.min_rate);
  if (includeAge) base.age = ageFromBirthDate(row.birth_date);
  return base;
}

export function toPublicDirectoryCard(row: Record<string, unknown>): Record<string, unknown> {
  return withFilterFields(pickColumns(row, DIRECTORY_CARD_COLUMNS), row, true);
}

export function toPublicNewlyApproved(row: Record<string, unknown>): Record<string, unknown> {
  const out = withFilterFields(
    pickColumns(row, [...DIRECTORY_CARD_COLUMNS, ...NEWLY_APPROVED_EXTRA_COLUMNS]),
    row,
    false
  );
  out.videos = visibleVideos(row.videos, row.hidden_videos);
  delete out.hidden_videos;
  return out;
}

export function toPublicProfile(row: Record<string, unknown>): Record<string, unknown> {
  const base = withFilterFields(
    pickColumns(row, [...DIRECTORY_CARD_COLUMNS, ...PUBLIC_PROFILE_EXTRA_COLUMNS]),
    row,
    false
  );
  base.videos = visibleVideos(row.videos, row.hidden_videos);
  delete base.hidden_videos;
  const displayPackages = resolvePackagesForDisplay(row.service_packages, row.rate_card);
  base.has_min_rate = displayPackages.length > 0 || hasListedMinRate(row.min_rate);
  base.has_priced_min_rate =
    displayPackages.some((p) => isConcretePrice(p.price)) || hasPricedMinRate(row.min_rate);
  base.rate_card_flags = rateCardFlags(row.rate_card);
  base.service_packages = publicServicePackages(row.service_packages, row.rate_card);
  base.service_extras = publicExtrasFromRateCard(row.rate_card, priceTierFromMinRate);
  return base;
}

export const DIRECTORY_QUERY_COLUMNS = [
  ...DIRECTORY_CARD_COLUMNS,
  "birth_date",
  ...PRICING_SOURCE_COLUMNS,
] as const;
export const NEWLY_APPROVED_QUERY_COLUMNS = [
  ...DIRECTORY_CARD_COLUMNS,
  ...NEWLY_APPROVED_EXTRA_COLUMNS,
  ...PRICING_SOURCE_COLUMNS,
] as const;
export const PROFILE_QUERY_COLUMNS = [
  ...DIRECTORY_CARD_COLUMNS,
  ...PUBLIC_PROFILE_EXTRA_COLUMNS,
  ...PRICING_SOURCE_COLUMNS,
] as const;

/**
 * Columns rendered into public HTML, metadata, and JSON-LD.
 * Private columns (email, birth date, prices, auth id) are not in this list.
 * Profile loaders also read PRICING_SOURCE_COLUMNS server-side and publish
 * only `from_price`.
 */
export const SEO_PROFILE_COLUMNS = [
  ...DIRECTORY_CARD_COLUMNS,
  ...PUBLIC_PROFILE_EXTRA_COLUMNS,
] as const;
export const COMMERCIAL_QUERY_COLUMNS = ["id", "min_rate", "rate_card", "service_packages"] as const;

export type CommercialInfluencer = {
  id: string;
  min_rate: string | null;
  rate_card: Record<string, string> | null;
  service_packages: PublicPackageView[];
  service_extras: PublicExtraView[];
};

function asPriceString(value: unknown): string | null {
  if (!isConcretePrice(value)) return null;
  return typeof value === "string" ? value.trim() : String(value);
}

function listedRate(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function commercialRateCard(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of RATE_CARD_KEYS) {
    const price = asPriceString(src[key]);
    if (price) out[key] = price;
  }
  return Object.keys(out).length ? out : null;
}

function commercialPackages(
  raw: unknown,
  rateCard: unknown
): CommercialInfluencer["service_packages"] {
  return resolvePackagesForDisplay(raw, rateCard).map((pkg) =>
    toCommercialPackageView(pkg, "en", priceTierFromMinRate)
  );
}

/** Exact prices for a logged-in brand. No email, birth date, or auth id. */
export function toCommercialInfluencer(row: Record<string, unknown>): CommercialInfluencer {
  return {
    id: String(row.id ?? ""),
    min_rate: listedRate(row.min_rate),
    rate_card: commercialRateCard(row.rate_card),
    service_packages: commercialPackages(row.service_packages, row.rate_card),
    service_extras: commercialExtrasFromRateCard(row.rate_card, priceTierFromMinRate),
  };
}

const PRIVATE_KEY_PATTERN =
  /^(contact_email|birth_date|auth_user_id|min_rate|rate_card|approval_notes|analytics_verification_notes|email|phone|password|token|access_token|refresh_token)$/i;

/** Returns dotted paths of private keys. `service_packages[].price` counts as private. */
export function findPrivateFieldPaths(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findPrivateFieldPaths(entry, `${path}[${index}]`));
  }
  if (!value || typeof value !== "object") return [];
  const found: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const here = path ? `${path}.${key}` : key;
    if (PRIVATE_KEY_PATTERN.test(key) || key === "price") found.push(here);
    found.push(...findPrivateFieldPaths(child, here));
  }
  return found;
}
