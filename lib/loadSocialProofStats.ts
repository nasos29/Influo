import { supabaseService } from "@/lib/apiAuth";
import { isBrandTargetReview } from "@/lib/brandReview";
import { testBrandIdsFilter } from "@/lib/testBrandIds";

export type SocialProofStats = {
  completedCollaborations: number | null;
  activeCreators: number | null;
  brandsCount: number | null;
  averageRating: number | null;
  computedAt: string | null;
  /** True when served from DB daily cache (or just refreshed). */
  fromCache: boolean;
};

const CACHE_ID = "global";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type CacheRow = {
  completed_collaborations: number;
  active_creators: number;
  brands_count: number;
  average_rating: number | string | null;
  computed_at: string;
};

function rowToStats(row: CacheRow, fromCache: boolean): SocialProofStats {
  const avg =
    row.average_rating == null || row.average_rating === ""
      ? null
      : Number(row.average_rating);
  return {
    completedCollaborations: row.completed_collaborations,
    activeCreators: row.active_creators,
    brandsCount: row.brands_count,
    averageRating: avg != null && Number.isFinite(avg) ? Math.round(avg * 10) / 10 : null,
    computedAt: row.computed_at,
    fromCache,
  };
}

async function computeFreshStats(): Promise<Omit<SocialProofStats, "fromCache" | "computedAt"> & { computedAt: string }> {
  const admin = supabaseService();
  const nowIso = new Date().toISOString();

  let completedCollaborations: number | null = null;
  let activeCreators: number | null = null;
  let brandsCount: number | null = null;
  let averageRating: number | null = null;

  try {
    const [proposalsCount, appsCount] = await Promise.all([
      admin
        .from("proposals")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
      admin
        .from("campaign_applications")
        .select("id", { count: "exact", head: true })
        .eq("deliverable_status", "approved"),
    ]);
    const a = !proposalsCount.error && typeof proposalsCount.count === "number" ? proposalsCount.count : 0;
    const b = !appsCount.error && typeof appsCount.count === "number" ? appsCount.count : 0;
    if (!proposalsCount.error || !appsCount.error) {
      completedCollaborations = a + b;
    }
  } catch (error) {
    console.error("loadSocialProofStats completed", error);
  }

  try {
    const { count, error } = await admin
      .from("influencers")
      .select("id", { count: "exact", head: true })
      .eq("approved", true);
    if (!error && typeof count === "number") activeCreators = count;
  } catch (error) {
    console.error("loadSocialProofStats creators", error);
  }

  try {
    const { count, error } = await admin
      .from("brands")
      .select("id", { count: "exact", head: true })
      .not("id", "in", testBrandIdsFilter());
    if (!error && typeof count === "number") brandsCount = count;
  } catch (error) {
    console.error("loadSocialProofStats brands", error);
  }

  try {
    // Narrow select: rating only, brand→creator reviews (exclude creator→brand marker rows).
    const { data, error } = await admin
      .from("influencer_reviews")
      .select("rating, project_type")
      .not("rating", "is", null)
      .limit(5000);
    if (!error && Array.isArray(data) && data.length > 0) {
      let sum = 0;
      let n = 0;
      for (const row of data) {
        if (isBrandTargetReview(typeof row.project_type === "string" ? row.project_type : null)) continue;
        const rating = typeof row.rating === "number" ? row.rating : Number(row.rating);
        if (!Number.isFinite(rating) || rating < 1 || rating > 5) continue;
        sum += rating;
        n += 1;
      }
      if (n > 0) averageRating = Math.round((sum / n) * 10) / 10;
    }
  } catch (error) {
    console.error("loadSocialProofStats rating", error);
  }

  return {
    completedCollaborations,
    activeCreators,
    brandsCount,
    averageRating,
    computedAt: nowIso,
  };
}

/**
 * Platform social-proof numbers. Reads daily cache row when fresh (&lt; 24h);
 * otherwise recomputes with head counts / narrow selects and upserts the cache.
 * Failures return nulls so the UI can hide items.
 */
export async function loadSocialProofStats(): Promise<SocialProofStats> {
  const admin = supabaseService();

  try {
    const cached = await admin
      .from("platform_social_proof_stats")
      .select(
        "completed_collaborations, active_creators, brands_count, average_rating, computed_at"
      )
      .eq("id", CACHE_ID)
      .maybeSingle();

    if (!cached.error && cached.data?.computed_at) {
      const age = Date.now() - Date.parse(String(cached.data.computed_at));
      if (Number.isFinite(age) && age >= 0 && age < ONE_DAY_MS) {
        return rowToStats(cached.data as CacheRow, true);
      }
    }
  } catch (error) {
    console.error("loadSocialProofStats cache read", error);
  }

  const fresh = await computeFreshStats();

  try {
    await admin.from("platform_social_proof_stats").upsert(
      {
        id: CACHE_ID,
        completed_collaborations: fresh.completedCollaborations ?? 0,
        active_creators: fresh.activeCreators ?? 0,
        brands_count: fresh.brandsCount ?? 0,
        average_rating: fresh.averageRating,
        computed_at: fresh.computedAt,
      },
      { onConflict: "id" }
    );
  } catch (error) {
    console.error("loadSocialProofStats cache write", error);
  }

  return {
    ...fresh,
    fromCache: false,
  };
}
