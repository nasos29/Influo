import { normalizeGender, type GenderValue } from "@/lib/gender";
import { parseStoredCategories } from "@/lib/categories";
import { resolveCompletionRate } from "@/lib/completionRate";
import { parseFollowerString } from "@/lib/parseFollowers";
import { toPublicProfile, type RateCardFlags } from "@/lib/publicInfluencer";
import type { PublicExtraView } from "@/lib/servicePackages";

export type ProfileViewModel = {
  id: string;
  name: string;
  bio: string;
  bio_en: string | null;
  avatar: string | null;
  verified: boolean;
  socials: Record<string, string>;
  followers: Record<string, number>;
  categories: string[];
  platform: string;
  gender: GenderValue;
  location?: string;
  languages: string[];
  has_min_rate: boolean;
  has_priced_min_rate: boolean;
  price_tier: string;
  videos: string[];
  video_thumbnails: Record<string, string> | null;
  engagement_rate?: string | Record<string, string>;
  avg_likes?: string | Record<string, string>;
  accounts: Array<Record<string, unknown>>;
  audience_data: { male: number | null; female: number | null; top_age: string };
  rate_card_flags: RateCardFlags;
  service_extras: PublicExtraView[];
  past_brands: string[];
  avg_rating: number;
  total_reviews: number;
  avg_response_time?: number;
  completion_rate?: number;
  availability_status: string;
  skills: string[];
  certifications: string[];
  service_packages: Array<{
    name: string;
    description?: string;
    includes?: string[];
    has_price?: boolean;
  }>;
  created_at?: string;
  profile_slug?: string | null;
  auditpr_audit?: {
    scoreBreakdown: string[];
    scoreBreakdown_en?: string[];
    whyWorkWithThem?: string;
    whyWorkWithThem_en?: string;
    positives?: string[];
    positives_en?: string[];
    negatives?: string[];
    negatives_en?: string[];
    brandSafe: boolean;
    niche?: string;
    niche_en?: string;
  };
};

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((part) => part.trim()).filter(Boolean);
  }
  return [];
}

/** Maps a sanitized public profile row into the shape the profile page renders. */
export function viewModelFromPublicRow(row: Record<string, unknown>): ProfileViewModel {
  const data = toPublicProfile(row);
  const socials: Record<string, string> = {};
  const followers: Record<string, number> = {};
  const engagementRates: Record<string, string> = {};
  const avgLikes: Record<string, string> = {};
  const accounts = Array.isArray(data.accounts) ? (data.accounts as Array<Record<string, unknown>>) : [];

  for (const acc of accounts) {
    const platform = typeof acc.platform === "string" ? acc.platform.toLowerCase() : "";
    if (!platform) continue;
    if (typeof acc.username === "string" && acc.username) socials[platform] = acc.username;
    if (acc.followers != null && acc.followers !== "") {
      followers[platform] = parseFollowerString(acc.followers as string | number);
    }
    if (typeof acc.engagement_rate === "string" && acc.engagement_rate) {
      engagementRates[platform] = acc.engagement_rate;
    }
    if (typeof acc.avg_likes === "string" && acc.avg_likes) avgLikes[platform] = acc.avg_likes;
  }

  const category = typeof data.category === "string" ? data.category : "";
  const parsedCategories = parseStoredCategories(category);
  const categories = parsedCategories.length ? parsedCategories : ["Creator"];

  const audit = data.auditpr_audit;
  const flags = (data.rate_card_flags && typeof data.rate_card_flags === "object"
    ? data.rate_card_flags
    : {}) as ProfileViewModel["rate_card_flags"];

  return {
    id: String(data.id ?? ""),
    name: typeof data.display_name === "string" ? data.display_name : "",
    bio: typeof data.bio === "string" ? data.bio : "",
    bio_en: typeof data.bio_en === "string" ? data.bio_en : null,
    avatar: typeof data.avatar_url === "string" ? data.avatar_url : null,
    verified: !!data.analytics_verified,
    socials,
    followers,
    categories,
    platform: "Instagram",
    gender: normalizeGender(typeof data.gender === "string" ? data.gender : null),
    location: typeof data.location === "string" ? data.location : undefined,
    languages: asStringArray(data.languages),
    has_min_rate: !!data.has_min_rate,
    has_priced_min_rate: !!data.has_priced_min_rate,
    price_tier: typeof data.price_tier === "string" ? data.price_tier : "0",
    videos: Array.isArray(data.videos) ? data.videos.filter((item): item is string => typeof item === "string") : [],
    video_thumbnails:
      data.video_thumbnails && typeof data.video_thumbnails === "object"
        ? (data.video_thumbnails as Record<string, string>)
        : null,
    engagement_rate: Object.keys(engagementRates).length
      ? engagementRates
      : typeof data.engagement_rate === "string"
        ? data.engagement_rate
        : undefined,
    avg_likes: Object.keys(avgLikes).length
      ? avgLikes
      : typeof data.avg_likes === "string"
        ? data.avg_likes
        : undefined,
    accounts,
    audience_data: (() => {
      const male = typeof data.audience_male_percent === "number" ? data.audience_male_percent : null;
      const female =
        typeof data.audience_female_percent === "number" ? data.audience_female_percent : null;
      return {
        male: male == null && female == null ? null : male,
        female: male == null && female == null ? null : female,
        top_age: typeof data.audience_top_age === "string" ? data.audience_top_age : "?",
      };
    })(),
    rate_card_flags: flags,
    service_extras: Array.isArray(data.service_extras)
      ? (data.service_extras as PublicExtraView[])
      : [],
    // Collaborations come from completed proposals (attached by loaders), not a DB column.
    past_brands: asStringArray(row.past_brands),
    avg_rating: typeof data.avg_rating === "number" ? data.avg_rating : 0,
    total_reviews: typeof data.total_reviews === "number" ? data.total_reviews : 0,
    avg_response_time: typeof data.avg_response_time === "number" ? data.avg_response_time : undefined,
    completion_rate: (() => {
      const usable = resolveCompletionRate(data.completion_rate);
      return usable == null ? undefined : usable;
    })(),
    availability_status: typeof data.availability_status === "string" ? data.availability_status : "available",
    skills: asStringArray(data.skills),
    certifications: asStringArray(data.certifications),
    service_packages: Array.isArray(data.service_packages)
      ? (data.service_packages as ProfileViewModel["service_packages"])
      : [],
    created_at: typeof data.created_at === "string" ? data.created_at : undefined,
    profile_slug: typeof data.profile_slug === "string" ? data.profile_slug : null,
    auditpr_audit:
      audit && typeof audit === "object"
        ? (audit as ProfileViewModel["auditpr_audit"])
        : undefined,
  };
}
