/**
 * Explicit allow-lists for influencer data that can leave the server
 * without a logged-in brand session.
 *
 * Prices, rate cards, contact email, birth date, and auth ids are never
 * copied here. Callers must not spread the raw database row into a response.
 */

import { sanitizeTopPosts } from "@/lib/topPosts";
import { visibleVideos } from "@/lib/hiddenVideos";

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

const RATE_CARD_KEYS = ["story", "post", "reel", "facebook", "youtube"] as const;

export type RateCardFlags = Partial<Record<(typeof RATE_CARD_KEYS)[number], boolean>>;

export type PublicServicePackage = {
  name: string;
  description: string;
  includes: string[];
  has_price: boolean;
};

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
export const DIRECTORY_BUDGET_CAPS = [100, 200, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000] as const;

export type PriceTier =
  | "0"
  | "100"
  | "200"
  | "500"
  | "1000"
  | "1500"
  | "2000"
  | "2500"
  | "3000"
  | "3500"
  | "4000"
  | "4500"
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

export function priceTierFromMinRate(minRate: unknown): PriceTier {
  const rate = parseDirectoryPrice(minRate);
  if (!(rate > 0)) return "0";
  for (const cap of DIRECTORY_BUDGET_CAPS) {
    if (cap === 5000) break;
    if (rate <= cap) return String(cap) as PriceTier;
  }
  if (rate < 5000) return "under_5000";
  if (rate <= 5000) return "5000";
  return "above_5000";
}

/** Drop-in for the directory budget dropdown. Matches the old min_rate comparison. */
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

export function publicServicePackages(raw: unknown): PublicServicePackage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const src = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const includes = Array.isArray(src.includes)
      ? src.includes.filter((entry): entry is string => typeof entry === "string")
      : [];
    return {
      name: typeof src.name === "string" ? src.name : "",
      description: typeof src.description === "string" ? src.description : "",
      includes,
      has_price: isConcretePrice(src.price),
    };
  });
}

function withFilterFields(base: Record<string, unknown>, row: Record<string, unknown>, includeAge: boolean) {
  base.price_tier = priceTierFromMinRate(row.min_rate);
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
  base.has_min_rate = hasListedMinRate(row.min_rate);
  base.has_priced_min_rate = hasPricedMinRate(row.min_rate);
  base.rate_card_flags = rateCardFlags(row.rate_card);
  base.service_packages = publicServicePackages(row.service_packages);
  return base;
}

export const DIRECTORY_QUERY_COLUMNS = [...DIRECTORY_CARD_COLUMNS, "birth_date", "min_rate"] as const;
export const NEWLY_APPROVED_QUERY_COLUMNS = [
  ...DIRECTORY_CARD_COLUMNS,
  ...NEWLY_APPROVED_EXTRA_COLUMNS,
  "min_rate",
] as const;
export const PROFILE_QUERY_COLUMNS = [
  ...DIRECTORY_CARD_COLUMNS,
  ...PUBLIC_PROFILE_EXTRA_COLUMNS,
  ...PRICING_SOURCE_COLUMNS,
] as const;

/**
 * Columns rendered into public HTML, metadata, and JSON-LD.
 * Private columns (email, birth date, prices, auth id) are not selected.
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
  service_packages: Array<{ name: string; description: string; price: string; includes: string[] }>;
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

function commercialPackages(raw: unknown): CommercialInfluencer["service_packages"] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const src = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const includes = Array.isArray(src.includes)
      ? src.includes.filter((entry): entry is string => typeof entry === "string")
      : [];
    return {
      name: typeof src.name === "string" ? src.name : "",
      description: typeof src.description === "string" ? src.description : "",
      price: asPriceString(src.price) || "",
      includes,
    };
  });
}

/** Exact prices for a logged-in brand. No email, birth date, or auth id. */
export function toCommercialInfluencer(row: Record<string, unknown>): CommercialInfluencer {
  return {
    id: String(row.id ?? ""),
    min_rate: listedRate(row.min_rate),
    rate_card: commercialRateCard(row.rate_card),
    service_packages: commercialPackages(row.service_packages) || [],
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
