/**
 * Short TTL cache for the brand recommendations influencer list
 * (approved + accounts) so filter toggles don't re-hit PostgREST every click.
 */

import { supabase } from "@/lib/supabaseClient";

const TTL_MS = 5 * 60_000;
const SELECT =
  "id, display_name, category, engagement_rate, avg_likes, location, gender, avg_rating, total_reviews, verified, approved, analytics_verified, accounts, avatar_url, audience_male_percent, audience_female_percent, audience_top_age, profile_slug, auditpr_audit->brandSafe, auditpr_audit->niche, auditpr_audit->niche_en, auditpr_audit->positives, auditpr_audit->positives_en, auditpr_audit->whyWorkWithThem, auditpr_audit->whyWorkWithThem_en";

type CacheEntry = { at: number; rows: Record<string, unknown>[] };

let entry: CacheEntry | null = null;
let inflight: Promise<Record<string, unknown>[]> | null = null;

export async function getApprovedInfluencersForRecommendations(): Promise<
  Record<string, unknown>[]
> {
  if (entry && Date.now() - entry.at < TTL_MS) return entry.rows;
  if (inflight) return inflight;

  inflight = (async () => {
    const { data, error } = await supabase
      .from("influencers")
      .select(SELECT)
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      // Fallback without JSON-path aliases if the project PostgREST rejects them.
      if (/brandSafe|niche|auditpr_audit/i.test(error.message)) {
        const fallback = await supabase
          .from("influencers")
          .select(
            "id, display_name, category, engagement_rate, avg_likes, location, gender, avg_rating, total_reviews, verified, approved, analytics_verified, accounts, avatar_url, audience_male_percent, audience_female_percent, audience_top_age, profile_slug"
          )
          .eq("approved", true)
          .order("created_at", { ascending: false })
          .limit(200);
        if (fallback.error) throw fallback.error;
        const rows = (fallback.data || []) as Record<string, unknown>[];
        entry = { at: Date.now(), rows };
        return rows;
      }
      throw error;
    }

    const rows = (data || []) as Record<string, unknown>[];
    entry = { at: Date.now(), rows };
    return rows;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

export function invalidateApprovedInfluencersListCache(): void {
  entry = null;
}
