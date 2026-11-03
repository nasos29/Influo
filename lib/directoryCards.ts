import type { Influencer } from "@/components/Directory";
import { normalizeGender } from "@/lib/gender";
import { parseFollowerString } from "@/lib/parseFollowers";
import { parseStoredCategories } from "@/lib/categories";
import { resolveCompletionRate } from "@/lib/completionRate";
import { findPrivateFieldPaths } from "@/lib/publicInfluencer";
import { loadDirectoryPage } from "@/lib/directoryPage";
import { DEFAULT_DIRECTORY_FILTERS } from "@/lib/directoryQuery";
import { sanitizeSkills } from "@/lib/skills";

function asLanguages(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string" || !value.trim()) return [];
  return value.split(",").map((part) => part.trim()).filter(Boolean);
}

export function mapDirectoryCard(row: Record<string, unknown>): Influencer {
  const socials: Record<string, string> = {};
  const followers: Record<string, number> = {};
  const engagementRates: Record<string, string> = {};
  const accounts = Array.isArray(row.accounts) ? (row.accounts as Array<Record<string, unknown>>) : [];

  for (const acc of accounts) {
    const platform = typeof acc.platform === "string" ? acc.platform.toLowerCase() : "";
    if (!platform || typeof acc.username !== "string" || !acc.username) continue;
    socials[platform] = acc.username;
    followers[platform] = parseFollowerString(acc.followers as string | number | null | undefined);
    if (typeof acc.engagement_rate === "string" && acc.engagement_rate) {
      engagementRates[platform] = acc.engagement_rate;
    }
  }

  const category = typeof row.category === "string" ? row.category : "";
  return {
    id: String(row.id ?? ""),
    name: typeof row.display_name === "string" ? row.display_name : "",
    bio: typeof row.bio === "string" ? row.bio : "",
    bio_en: typeof row.bio_en === "string" ? row.bio_en : null,
    avatar: typeof row.avatar_url === "string" ? row.avatar_url : "",
    verified: !!row.analytics_verified,
    socials,
    followers,
    categories: category ? (parseStoredCategories(category).length ? parseStoredCategories(category) : ["New"]) : ["New"],
    languages: asLanguages(row.languages),
    skills: sanitizeSkills(row.skills),
    platform: "Instagram",
    gender: normalizeGender(typeof row.gender === "string" ? row.gender : null),
    location: typeof row.location === "string" ? row.location : undefined,
    price_tier: typeof row.price_tier === "string" ? row.price_tier : "0",
    from_price: typeof row.from_price === "number" && row.from_price > 0 ? row.from_price : null,
    avg_likes: typeof row.avg_likes === "string" ? row.avg_likes : undefined,
    engagement_rate: Object.keys(engagementRates).length
      ? engagementRates
      : typeof row.engagement_rate === "string"
        ? row.engagement_rate
        : undefined,
    videos: Array.isArray(row.videos) ? row.videos.filter((item): item is string => typeof item === "string") : [],
    avg_rating: typeof row.avg_rating === "number" ? row.avg_rating : 0,
    total_reviews: typeof row.total_reviews === "number" ? row.total_reviews : 0,
    avg_response_time: typeof row.avg_response_time === "number" ? row.avg_response_time : null,
    completion_rate: resolveCompletionRate(row.completion_rate),
    past_brands: Array.isArray(row.past_brands) ? row.past_brands : typeof row.past_brands === "number" ? row.past_brands : 0,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    age: typeof row.age === "number" ? row.age : null,
    availability_status: typeof row.availability_status === "string" ? row.availability_status : "available",
    profile_slug: typeof row.profile_slug === "string" ? row.profile_slug : null,
    accounts: accounts as Influencer["accounts"],
    extra_badges: Array.isArray(row.extra_badges) ? row.extra_badges.map(String) : undefined,
  };
}

/** First directory page under the same default filters as the directory UI. */
export async function loadPublicDirectoryCards(limit = 24): Promise<{ influencers: Influencer[]; total: number }> {
  try {
    const page = await loadDirectoryPage(DEFAULT_DIRECTORY_FILTERS, 1, limit);
    const cards = page.data.map((row) => mapDirectoryCard(row));
    for (const card of cards) {
      const leaks = findPrivateFieldPaths(card);
      if (leaks.length) {
        throw new Error(`Directory card contained private fields: ${leaks.join(", ")}`);
      }
    }
    return { influencers: cards, total: page.total };
  } catch (error) {
    console.error("loadPublicDirectoryCards", error);
    return { influencers: [], total: 0 };
  }
}
