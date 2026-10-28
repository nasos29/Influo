import { loadHomeTrustStats } from "@/lib/loadHomeTrustStats";
import { supabaseService } from "@/lib/apiAuth";

export type PlatformMarketingStats = {
  approvedInfluencers: number | null;
  verifiedBrands: number | null;
  openCampaigns: number | null;
};

/**
 * Lightweight platform counts for marketing pages (ISR-friendly).
 * Uses count + head: true only. Failures return null so the strip can hide.
 */
export async function loadPlatformMarketingStats(): Promise<PlatformMarketingStats> {
  const base = await loadHomeTrustStats();
  let verifiedBrands: number | null = null;

  try {
    const { count, error } = await supabaseService()
      .from("brands")
      .select("id", { count: "exact", head: true })
      .eq("verified", true);
    if (!error && typeof count === "number") {
      verifiedBrands = count;
    } else if (error) {
      console.error("loadPlatformMarketingStats brands", error);
    }
  } catch (error) {
    console.error("loadPlatformMarketingStats brands", error);
  }

  return {
    approvedInfluencers: base.approvedInfluencers,
    verifiedBrands,
    openCampaigns: base.openCampaigns,
  };
}

/** Build display items; empty array means hide the strip. */
export function marketingStatItems(
  stats: PlatformMarketingStats,
  labels: {
    influencers: string;
    brands: string;
    campaigns: string;
  }
): Array<{ key: string; value: number; label: string }> {
  const items: Array<{ key: string; value: number; label: string }> = [];
  if (typeof stats.approvedInfluencers === "number" && stats.approvedInfluencers > 0) {
    items.push({
      key: "influencers",
      value: stats.approvedInfluencers,
      label: labels.influencers,
    });
  }
  if (typeof stats.verifiedBrands === "number" && stats.verifiedBrands > 0) {
    items.push({ key: "brands", value: stats.verifiedBrands, label: labels.brands });
  }
  if (typeof stats.openCampaigns === "number" && stats.openCampaigns > 0) {
    items.push({
      key: "campaigns",
      value: stats.openCampaigns,
      label: labels.campaigns,
    });
  }
  return items;
}
