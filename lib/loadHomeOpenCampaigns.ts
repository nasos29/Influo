import { supabaseService } from "@/lib/apiAuth";
import type { CampaignCardData } from "@/components/CampaignCard";
import { brandVerifiedFromJoin } from "@/lib/publicCampaignVisibility";

const SELECT = `
  id,
  title,
  description,
  budget,
  category,
  deliverables,
  deadline,
  created_at,
  platforms,
  compensation_type,
  min_followers,
  location,
  status,
  opened_at,
  cover_url,
  brands ( brand_name, logo_url, verified )
`;

async function loadApplicationsCounts(campaignIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (campaignIds.length === 0) return counts;
  for (const id of campaignIds) counts.set(id, 0);

  const { data, error } = await supabaseService()
    .from("campaign_applications")
    .select("campaign_id")
    .in("campaign_id", campaignIds)
    .neq("status", "withdrawn");

  if (error) {
    console.error("loadOpenCampaigns applications_count", error);
    return counts;
  }

  for (const row of data || []) {
    const id = row?.campaign_id != null ? String(row.campaign_id) : "";
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return counts;
}

/** Open public campaigns (ISR-friendly). Omit limit to return all matching rows. */
export async function loadOpenCampaigns(limit?: number): Promise<CampaignCardData[]> {
  try {
    const nowIso = new Date().toISOString();
    const run = (select: string) => {
      let query = supabaseService()
        .from("brand_campaigns")
        .select(select)
        .eq("status", "open")
        .or(`deadline.is.null,deadline.gt.${nowIso}`)
        .order("created_at", { ascending: false });
      if (typeof limit === "number") query = query.limit(limit);
      return query;
    };
    let { data, error } = await run(SELECT);
    // cover_url column not migrated yet: retry without it.
    if (error && /cover_url/i.test(error.message || "")) {
      ({ data, error } = await run(SELECT.replace(/\s*cover_url,/, "")));
    }
    if (error) {
      console.error("loadOpenCampaigns", error);
      return [];
    }
    // Same rule as detail page: only verified brands (list previously omitted this).
    const rows = ((data as unknown as CampaignCardData[]) || []).filter((row) =>
      brandVerifiedFromJoin(row.brands)
    );
    const ids = rows.map((r) => r.id).filter(Boolean);
    const counts = await loadApplicationsCounts(ids);
    return rows.map((row) => ({
      ...row,
      applications_count: counts.get(row.id) ?? 0,
    }));
  } catch (error) {
    console.error("loadOpenCampaigns", error);
    return [];
  }
}

/** Count non-withdrawn applications for one campaign (public — count only, no applicant rows). */
export async function loadCampaignApplicationsCount(campaignId: string): Promise<number> {
  if (!campaignId) return 0;
  try {
    const { count, error } = await supabaseService()
      .from("campaign_applications")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .neq("status", "withdrawn");
    if (error) {
      console.error("loadCampaignApplicationsCount", error);
      return 0;
    }
    return count ?? 0;
  } catch (error) {
    console.error("loadCampaignApplicationsCount", error);
    return 0;
  }
}

/** Open campaigns for the home page (ISR-friendly). */
export async function loadHomeOpenCampaigns(limit = 3): Promise<CampaignCardData[]> {
  return loadOpenCampaigns(limit);
}
