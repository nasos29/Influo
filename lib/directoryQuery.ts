/**
 * Directory list filters, sort, and paging. Same rules the directory page
 * used to apply in the browser after downloading every approved influencer.
 */

import { getBadges, type BadgeType } from "@/lib/badges";
import { categoriesMatchFilter, parseStoredCategories } from "@/lib/categories";
import { locationFilterMatches } from "@/lib/displayLocation";
import { normalizeGender, type GenderValue } from "@/lib/gender";
import {
  ageFromBirthDate,
  badgeMinRateFromTier,
  budgetTierMatches,
  lowestListedPrice,
  priceTierFromMinRate,
} from "@/lib/publicInfluencer";
import { isAvailableStatus } from "@/lib/trustSignals";
import { sanitizeSkills } from "@/lib/skills";

export const DIRECTORY_PAGE_SIZE = 40;

export const DIRECTORY_LANGUAGES = [
  { code: "el", el: "Ελληνικά", en: "Greek" },
  { code: "en", el: "Αγγλικά", en: "English" },
  { code: "de", el: "Γερμανικά", en: "German" },
  { code: "fr", el: "Γαλλικά", en: "French" },
  { code: "es", el: "Ισπανικά", en: "Spanish" },
  { code: "it", el: "Ιταλικά", en: "Italian" },
  { code: "pt", el: "Πορτογαλικά", en: "Portuguese" },
  { code: "ru", el: "Ρωσικά", en: "Russian" },
  { code: "zh", el: "Κινεζικά", en: "Chinese" },
  { code: "ja", el: "Ιαπωνικά", en: "Japanese" },
  { code: "sq", el: "Αλβανικά", en: "Albanian" },
  { code: "bg", el: "Βουλγαρικά", en: "Bulgarian" },
  { code: "tr", el: "Τουρκικά", en: "Turkish" },
] as const;

export type DirectoryFilters = {
  q: string;
  location: string;
  platform: string;
  category: string;
  gender: string;
  followers: string;
  budget: string;
  engagement: string;
  language: string;
  skills: string[];
  rating: string;
  ageMin: string;
  ageMax: string;
  badge: BadgeType | "All";
  availability: "available" | "unavailable" | "all";
};

export const DEFAULT_DIRECTORY_FILTERS: DirectoryFilters = {
  q: "",
  location: "",
  platform: "All",
  category: "All",
  gender: "All",
  followers: "All",
  budget: "All",
  engagement: "All",
  language: "All",
  skills: [],
  rating: "All",
  ageMin: "",
  ageMax: "",
  badge: "All",
  availability: "available",
};

export type DirectoryCandidate = {
  id: string;
  name: string;
  bio: string;
  categories: string[];
  gender: GenderValue;
  location?: string;
  languages: string[];
  skills: string[];
  socials: Record<string, string>;
  followers: Record<string, number>;
  engagement_rate?: string | Record<string, string>;
  price_tier: string;
  avg_rating: number;
  total_reviews: number;
  past_brands: string[] | number;
  created_at?: string;
  age: number | null;
  availability_status?: string | null;
  verified: boolean;
};

/** Followers as the directory cards parsed them (k / m suffixes, commas). */
export function directoryFollowerCount(value: unknown): number {
  if (value == null || value === "") return 0;
  const clean = String(value).toLowerCase().replace(/,/g, "").trim();
  if (!clean) return 0;
  if (clean.includes("k")) return parseFloat(clean) * 1000;
  if (clean.includes("m")) return parseFloat(clean) * 1_000_000;
  return parseFloat(clean) || 0;
}

export function directoryEngagement(rate?: string | Record<string, string> | null): number {
  if (!rate) return 0;
  if (typeof rate === "object" && !Array.isArray(rate)) {
    const rates = Object.values(rate).filter((v) => v && v !== "-");
    if (rates.length === 0) return 0;
    const parsed = rates.map((r) => parseFloat(String(r).replace("%", "").replace(",", ".")) || 0);
    return parsed.reduce((sum, n) => sum + n, 0) / parsed.length;
  }
  if (typeof rate === "string") {
    return parseFloat(rate.replace("%", "").replace(",", ".")) || 0;
  }
  return 0;
}

function asLanguages(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string" || !value.trim()) return [];
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

function maxFollowers(followers: Record<string, number>): number {
  const values = Object.values(followers);
  return values.length ? Math.max(...values) : 0;
}

/**
 * New accounts (under 30 days) sort first, then newest created_at.
 * A missing created_at sorts last. Equal timestamps keep a stable id order
 * only when the caller compares ids itself; this comparator matches the
 * previous browser sort, which is the same order as created_at DESC NULLS LAST
 * because "new" is exactly the newest 30 days.
 */
export function compareDirectoryOrder(
  a: { created_at?: string | null; id?: string },
  b: { created_at?: string | null; id?: string },
  now = Date.now()
): number {
  const ageDays = (created?: string | null) => {
    if (!created) return 999;
    const time = new Date(created).getTime();
    if (Number.isNaN(time)) return 999;
    return Math.floor((now - time) / (1000 * 60 * 60 * 24));
  };
  const aNew = ageDays(a.created_at) < 30;
  const bNew = ageDays(b.created_at) < 30;
  if (aNew && !bNew) return -1;
  if (!aNew && bNew) return 1;
  if (a.created_at && b.created_at) {
    const delta = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (delta !== 0) return delta;
  } else if (a.created_at) return -1;
  else if (b.created_at) return 1;
  if (a.id && b.id && a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

export function directoryCandidateFromRow(
  row: Record<string, unknown>,
  pastBrands: string[] | number = 0
): DirectoryCandidate {
  const socials: Record<string, string> = {};
  const followers: Record<string, number> = {};
  const engagementRates: Record<string, string> = {};
  const accounts = Array.isArray(row.accounts) ? row.accounts : [];
  for (const item of accounts) {
    if (!item || typeof item !== "object") continue;
    const acc = item as Record<string, unknown>;
    const platform = typeof acc.platform === "string" ? acc.platform.toLowerCase() : "";
    const username = typeof acc.username === "string" ? acc.username : "";
    if (!platform || !username) continue;
    socials[platform] = username;
    followers[platform] = directoryFollowerCount(acc.followers);
    if (acc.engagement_rate) engagementRates[platform] = String(acc.engagement_rate);
  }
  const fromPrice = lowestListedPrice(row);
  const category = row.category;
  const parsed = parseStoredCategories(category);
  const created = typeof row.created_at === "string" ? row.created_at : undefined;
  return {
    id: String(row.id ?? ""),
    name: typeof row.display_name === "string" ? row.display_name : "",
    bio: typeof row.bio === "string" ? row.bio : "",
    categories: parsed.length ? parsed : category ? ["New"] : ["New"],
    gender: normalizeGender(typeof row.gender === "string" ? row.gender : null),
    location: typeof row.location === "string" ? row.location : undefined,
    languages: asLanguages(row.languages),
    skills: sanitizeSkills(row.skills),
    socials,
    followers,
    engagement_rate: Object.keys(engagementRates).length
      ? engagementRates
      : typeof row.engagement_rate === "string"
        ? row.engagement_rate
        : undefined,
    price_tier: priceTierFromMinRate(fromPrice ?? row.min_rate),
    avg_rating: typeof row.avg_rating === "number" ? row.avg_rating : Number(row.avg_rating) || 0,
    total_reviews: typeof row.total_reviews === "number" ? row.total_reviews : Number(row.total_reviews) || 0,
    past_brands: pastBrands,
    created_at: created,
    age: ageFromBirthDate(row.birth_date),
    availability_status: typeof row.availability_status === "string" ? row.availability_status : null,
    verified: !!row.analytics_verified,
  };
}

function languageMatches(languages: string[] | undefined, code: string): boolean {
  if (code === "All") return true;
  if (!languages || languages.length === 0) return false;
  const selected = DIRECTORY_LANGUAGES.find((item) => item.code === code);
  if (!selected) return false;
  const selectedEl = selected.el.toLowerCase();
  const selectedEn = selected.en.toLowerCase();
  const selectedCode = selected.code.toLowerCase();
  return languages.some((langItem) => {
    const langStr = langItem.toString().toLowerCase().trim();
    return (
      langStr === selectedCode ||
      langStr === selectedEl ||
      langStr === selectedEn ||
      langStr.includes(selectedEl) ||
      langStr.includes(selectedEn) ||
      selectedEl.includes(langStr) ||
      selectedEn.includes(langStr)
    );
  });
}

function badgeTypes(candidate: DirectoryCandidate, now = Date.now()): BadgeType[] {
  const accountAgeDays = candidate.created_at
    ? Math.floor((now - new Date(candidate.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 999;
  return getBadges(
    {
      verified: candidate.verified,
      followers: candidate.followers,
      engagement_rate: candidate.engagement_rate,
      total_reviews: candidate.total_reviews || 0,
      avg_rating: candidate.avg_rating || 0,
      past_brands: candidate.past_brands || 0,
      account_created_days: Number.isNaN(accountAgeDays) ? 999 : accountAgeDays,
      min_rate: badgeMinRateFromTier(candidate.price_tier),
    },
    "el"
  ).map((badge) => badge.type);
}

export function matchesDirectoryFilters(
  candidate: DirectoryCandidate,
  filters: DirectoryFilters,
  now = Date.now()
): boolean {
  const q = filters.q.trim().toLowerCase();
  const searchMatch = !q || candidate.name.toLowerCase().includes(q) || candidate.bio.toLowerCase().includes(q);
  const locationMatch = locationFilterMatches(candidate.location, filters.location);
  const platformMatch =
    filters.platform === "All" || candidate.socials[filters.platform.toLowerCase()] !== undefined;
  const categoryMatch = categoriesMatchFilter(candidate.categories, filters.category);
  const genderMatch = filters.gender === "All" || candidate.gender === filters.gender;

  let followerMatch = true;
  const followers = maxFollowers(candidate.followers);
  if (filters.followers === "Nano") followerMatch = followers > 1000 && followers < 10000;
  if (filters.followers === "Micro") followerMatch = followers >= 10000 && followers < 100000;
  if (filters.followers === "Macro") followerMatch = followers >= 100000;

  const budgetMatch = budgetTierMatches(candidate.price_tier, filters.budget === "All" ? "All" : filters.budget);

  let engageMatch = true;
  if (filters.engagement !== "All") {
    const min = parseFloat(filters.engagement);
    if (directoryEngagement(candidate.engagement_rate) < min) engageMatch = false;
  }

  const languageMatch = languageMatches(candidate.languages, filters.language);
  const wantedSkills = sanitizeSkills(filters.skills);
  const skillMatch = wantedSkills.every((key) => candidate.skills.includes(key));

  let ratingMatch = true;
  if (filters.rating !== "All") {
    const min = parseFloat(filters.rating);
    if ((candidate.avg_rating || 0) < min) ratingMatch = false;
  }

  let ageMatch = true;
  if (filters.ageMin !== "" || filters.ageMax !== "") {
    const min = filters.ageMin !== "" ? parseInt(filters.ageMin, 10) : 0;
    const max = filters.ageMax !== "" ? parseInt(filters.ageMax, 10) : 999;
    if (candidate.age === null) ageMatch = false;
    else if (candidate.age < min || candidate.age > max) ageMatch = false;
  }

  const badgeMatch = filters.badge === "All" || badgeTypes(candidate, now).includes(filters.badge);

  let availabilityMatch = true;
  if (filters.availability === "available") availabilityMatch = isAvailableStatus(candidate.availability_status);
  else if (filters.availability === "unavailable") availabilityMatch = !isAvailableStatus(candidate.availability_status);

  return (
    searchMatch &&
    locationMatch &&
    platformMatch &&
    categoryMatch &&
    genderMatch &&
    followerMatch &&
    budgetMatch &&
    engageMatch &&
    languageMatch &&
    skillMatch &&
    ratingMatch &&
    ageMatch &&
    badgeMatch &&
    availabilityMatch
  );
}

/** Filters that can be expressed as PostgREST predicates without scanning JSON. */
export function directoryFiltersAreSqlOnly(filters: DirectoryFilters): boolean {
  return (
    !filters.q.trim() &&
    !filters.location.trim() &&
    filters.platform === "All" &&
    filters.category === "All" &&
    filters.followers === "All" &&
    filters.budget === "All" &&
    filters.engagement === "All" &&
    filters.language === "All" &&
    filters.skills.length === 0 &&
    filters.ageMin.trim() === "" &&
    filters.ageMax.trim() === "" &&
    filters.badge === "All"
  );
}

/** Search, category, place, language, and age need text columns, not account JSON. */
export function directoryFiltersNeedAccounts(filters: DirectoryFilters): boolean {
  return (
    filters.platform !== "All" ||
    filters.followers !== "All" ||
    filters.budget !== "All" ||
    filters.engagement !== "All" ||
    filters.badge !== "All"
  );
}

export function parseDirectoryFilters(params: URLSearchParams): DirectoryFilters {
  const availability = params.get("availability");
  const badge = params.get("badge");
  const badges: Array<BadgeType | "All"> = ["All", "new", "rising", "verified", "top_performer", "pro", "elite", "vip"];
  return {
    q: (params.get("q") || "").trim(),
    location: (params.get("location") || "").trim(),
    platform: params.get("platform") || "All",
    category: params.get("category") || "All",
    gender: params.get("gender") || "All",
    followers: params.get("followers") || "All",
    budget: params.get("budget") || "All",
    engagement: params.get("engagement") || "All",
    language: params.get("language") || "All",
    skills: sanitizeSkills((params.get("skills") || "").split(",")),
    rating: params.get("rating") || "All",
    ageMin: params.get("ageMin") || "",
    ageMax: params.get("ageMax") || "",
    badge: badges.includes(badge as BadgeType | "All") ? (badge as BadgeType | "All") : "All",
    availability:
      availability === "unavailable" || availability === "all" || availability === "available"
        ? availability
        : "available",
  };
}

export function directoryCacheKey(filters: DirectoryFilters, page: number, pageSize: number): string {
  return JSON.stringify({ filters, page, pageSize });
}

export function clampDirectoryPage(page: number, total: number, pageSize: number): number {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(page, totalPages);
}
