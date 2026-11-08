import { parseStoredCategories } from "./categories.ts";
import { lowestListedPrice } from "./publicInfluencer.ts";
import type { InfluencerProfile } from "./recommendations.ts";

/** Columns needed by rowToMatchProfile (server-side scoring). */
export const MATCH_PROFILE_COLUMNS =
  "id, display_name, category, accounts, location, avg_rating, total_reviews, verified, analytics_verified, auditpr_audit, skills, min_rate, service_packages, rate_card, availability_status, languages";

/** Raw influencers row → InfluencerProfile for recommendInfluencers (no private fields). */
export function rowToMatchProfile(r: Record<string, unknown>): InfluencerProfile {
  const cats = parseStoredCategories(r.category);
  const audit = (r.auditpr_audit && typeof r.auditpr_audit === "object" ? r.auditpr_audit : {}) as Record<string, unknown>;
  return {
    id: String(r.id),
    display_name: String(r.display_name || ""),
    category: cats[0] || (typeof r.category === "string" ? r.category : undefined),
    categories: cats,
    accounts: Array.isArray(r.accounts) ? (r.accounts as InfluencerProfile["accounts"]) : null,
    location: typeof r.location === "string" ? r.location : null,
    avg_rating: typeof r.avg_rating === "number" ? r.avg_rating : r.avg_rating != null ? Number(r.avg_rating) : null,
    total_reviews: typeof r.total_reviews === "number" ? r.total_reviews : 0,
    verified: Boolean(r.analytics_verified || r.verified),
    min_rate: typeof r.min_rate === "string" ? r.min_rate : null,
    from_price: lowestListedPrice({ service_packages: r.service_packages, rate_card: r.rate_card, min_rate: r.min_rate, accounts: r.accounts }),
    languages: (r.languages as InfluencerProfile["languages"]) ?? null,
    skills: Array.isArray(r.skills) ? (r.skills as string[]) : null,
    auditpr_audit: {
      brandSafe: audit.brandSafe === true,
      niche: typeof audit.niche === "string" ? audit.niche : null,
      niche_en: typeof audit.niche_en === "string" ? audit.niche_en : null,
    },
  };
}
