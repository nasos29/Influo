import { supabaseService } from "@/lib/apiAuth";

export type HomeTrustStats = {
  /** Approved influencers count, or null when the query failed. */
  approvedInfluencers: number | null;
  /** Open campaigns count, or null when the query failed. */
  openCampaigns: number | null;
};

/**
 * Lightweight counts for the home trust row (ISR-friendly).
 * Uses count + head: true — never select('*').
 * Failures return null so the UI can hide the row/item without errors.
 */
export async function loadHomeTrustStats(): Promise<HomeTrustStats> {
  let approvedInfluencers: number | null = null;
  let openCampaigns: number | null = null;

  try {
    const { count, error } = await supabaseService()
      .from("influencers")
      .select("id", { count: "exact", head: true })
      .eq("approved", true);
    if (!error && typeof count === "number") {
      approvedInfluencers = count;
    } else if (error) {
      console.error("loadHomeTrustStats influencers", error);
    }
  } catch (error) {
    console.error("loadHomeTrustStats influencers", error);
  }

  try {
    const nowIso = new Date().toISOString();
    const { count, error } = await supabaseService()
      .from("brand_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .or(`deadline.is.null,deadline.gt.${nowIso}`);
    if (!error && typeof count === "number") {
      openCampaigns = count;
    } else if (error) {
      console.error("loadHomeTrustStats campaigns", error);
    }
  } catch (error) {
    console.error("loadHomeTrustStats campaigns", error);
  }

  return { approvedInfluencers, openCampaigns };
}

/** Floor to tens for display, e.g. 338 → 330. */
export function floorToTens(n: number): number {
  return Math.floor(Math.max(0, n) / 10) * 10;
}
