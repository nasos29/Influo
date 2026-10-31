import { supabaseService } from "@/lib/apiAuth";

/** Same public visibility rule for list + detail: open, not expired, verified brand. */
export function isPublicCampaignDeadlineOk(
  deadline: string | null | undefined,
  now = new Date()
): boolean {
  if (!deadline) return true;
  const t = new Date(deadline).getTime();
  if (Number.isNaN(t)) return true;
  return t > now.getTime();
}

export function brandVerifiedFromJoin(brands: unknown): boolean {
  if (!brands) return false;
  const row = Array.isArray(brands) ? brands[0] : brands;
  if (!row || typeof row !== "object") return false;
  return !!(row as { verified?: boolean | null }).verified;
}

const DETAIL_SELECT = `
  id,
  brand_id,
  title,
  description,
  budget,
  category,
  deliverables,
  deadline,
  opened_at,
  created_at,
  starts_on,
  location,
  min_followers,
  platforms,
  compensation_type,
  status,
  cover_url,
  brands ( brand_name, logo_url, bio, city, website, instagram, verified )
`;

const DETAIL_SELECT_NO_COVER = DETAIL_SELECT.replace(/\s*cover_url,/, "");

export type PublicCampaignRow = {
  id: string;
  brand_id?: string | null;
  title: string;
  description: string;
  budget: number;
  category: string | null;
  deliverables: string | null;
  deadline: string | null;
  opened_at?: string | null;
  created_at?: string | null;
  starts_on?: string | null;
  location?: string | null;
  min_followers?: number | null;
  platforms?: string[] | null;
  compensation_type?: string | null;
  status: string;
  cover_url?: string | null;
  brands:
    | {
        brand_name: string;
        logo_url: string | null;
        bio?: string | null;
        city?: string | null;
        website?: string | null;
        instagram?: string | null;
        verified?: boolean | null;
      }
    | {
        brand_name: string;
        logo_url: string | null;
        bio?: string | null;
        city?: string | null;
        website?: string | null;
        instagram?: string | null;
        verified?: boolean | null;
      }[]
    | null;
};

/**
 * Load one publicly visible campaign by id (service role — same filters as /campaigns list).
 * Returns null when not open, expired, or brand not verified.
 */
export async function loadPublicCampaignById(id: string): Promise<PublicCampaignRow | null> {
  if (!id) return null;
  try {
    const nowIso = new Date().toISOString();
    const run = (select: string) =>
      supabaseService()
        .from("brand_campaigns")
        .select(select)
        .eq("id", id)
        .eq("status", "open")
        .or(`deadline.is.null,deadline.gt.${nowIso}`)
        .maybeSingle();

    let { data, error } = await run(DETAIL_SELECT);
    if (error && /cover_url/i.test(error.message || "")) {
      ({ data, error } = await run(DETAIL_SELECT_NO_COVER));
    }
    if (error) {
      console.error("loadPublicCampaignById", error);
      return null;
    }
    if (!data || (data as unknown as PublicCampaignRow).status !== "open") return null;
    const row = data as unknown as PublicCampaignRow;
    if (!brandVerifiedFromJoin(row.brands)) return null;
    if (!isPublicCampaignDeadlineOk(row.deadline)) return null;
    return row;
  } catch (err) {
    console.error("loadPublicCampaignById", err);
    return null;
  }
}
