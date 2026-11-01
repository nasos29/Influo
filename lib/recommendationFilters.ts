import { categoriesMatchFilter } from "@/lib/categories";
import { locationFilterMatches } from "@/lib/displayLocation";
import type { InfluencerProfile } from "@/lib/recommendations";
import { sanitizeSkills } from "@/lib/skills";

/** Kept off the form. Recommendations below this score stay hidden. */
export const RECOMMENDATION_MIN_SCORE = 40;

export type RecommendationAudience = "" | "nano" | "micro" | "macro";

export type RecommendationFilterState = {
  category: string;
  platform: string;
  location: string;
  maxPrice: number | null;
  skills: string[];
  audience: RecommendationAudience;
};

export const EMPTY_RECOMMENDATION_FILTERS: RecommendationFilterState = {
  category: "",
  platform: "",
  location: "",
  maxPrice: null,
  skills: [],
  audience: "",
};

function parseFollowers(value: unknown): number {
  if (value == null || value === "") return 0;
  const clean = String(value).toLowerCase().replace(/,/g, "").trim();
  if (!clean) return 0;
  if (clean.includes("k")) return parseFloat(clean) * 1000;
  if (clean.includes("m")) return parseFloat(clean) * 1_000_000;
  return parseFloat(clean) || 0;
}

/** Largest audience, or the selected platform when one is chosen. */
export function recommendationFollowerCount(profile: InfluencerProfile, platform: string): number {
  const accounts = Array.isArray(profile.accounts) ? profile.accounts : [];
  const wanted = platform.trim().toLowerCase();
  if (wanted) {
    const account = accounts.find((item) => String(item?.platform || "").toLowerCase() === wanted);
    return account ? parseFollowers(account.followers) : 0;
  }
  const counts = accounts.map((item) => parseFollowers(item?.followers));
  return Math.max(parseFollowers(profile.followers_count), ...counts, 0);
}

function audienceMatches(count: number, audience: RecommendationAudience): boolean {
  if (audience === "nano") return count > 1000 && count < 10000;
  if (audience === "micro") return count >= 10000 && count < 100000;
  if (audience === "macro") return count >= 100000;
  return true;
}

export function filterRecommendationProfiles(
  profiles: InfluencerProfile[],
  filters: RecommendationFilterState
): InfluencerProfile[] {
  const skills = sanitizeSkills(filters.skills);
  return profiles.filter((profile) => {
    if (filters.category && !categoriesMatchFilter(profile.categories?.length ? profile.categories : profile.category, filters.category)) {
      return false;
    }
    const platform = filters.platform.trim().toLowerCase();
    if (platform) {
      const accounts = Array.isArray(profile.accounts) ? profile.accounts : [];
      if (!accounts.some((item) => String(item?.platform || "").toLowerCase() === platform)) return false;
    }
    if (!locationFilterMatches(profile.location, filters.location)) return false;
    if (filters.maxPrice != null && filters.maxPrice > 0) {
      const price = profile.from_price != null && profile.from_price > 0 ? profile.from_price : null;
      if (price == null || price > filters.maxPrice) return false;
    }
    if (skills.length) {
      const have = new Set(sanitizeSkills(profile.skills));
      if (!skills.some((key) => have.has(key))) return false;
    }
    if (!audienceMatches(recommendationFollowerCount(profile, filters.platform), filters.audience)) return false;
    return true;
  });
}
