import { supabaseService } from "@/lib/apiAuth";
import type { CampaignCardData } from "@/components/CampaignCard";

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
  brands ( brand_name, logo_url, verified )
`;

/** Open campaigns for the home page (ISR-friendly). */
export async function loadHomeOpenCampaigns(limit = 3): Promise<CampaignCardData[]> {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseService()
      .from("brand_campaigns")
      .select(SELECT)
      .eq("status", "open")
      .or(`deadline.is.null,deadline.gt.${nowIso}`)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("loadHomeOpenCampaigns", error);
      return [];
    }
    return (data as unknown as CampaignCardData[]) || [];
  } catch (error) {
    console.error("loadHomeOpenCampaigns", error);
    return [];
  }
}
