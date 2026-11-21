import type { SupabaseClient } from "@supabase/supabase-js";
import { isRealDeliveryComplete } from "@/lib/deliveryCompletion";

export type ProposalBrandRow = {
  influencer_id?: string | null;
  brand_name?: string | null;
  status?: string | null;
  restored_at?: string | null;
  published_post_url?: string | null;
  delivery_confirmed_at?: string | null;
  auto_completed_at?: string | null;
};

/** Restored admin deals stay off public past brands until a real deliverable exists. */
export function hasPastBrandShowcaseDeliverable(row: ProposalBrandRow): boolean {
  const url = String(row.published_post_url || "").trim();
  if (url) return true;
  return isRealDeliveryComplete(row);
}

export function includeRowInPastBrands(row: ProposalBrandRow): boolean {
  const status = row.status != null ? String(row.status).trim().toLowerCase() : "";
  if (status === "cancelled") return false;
  if (status && status !== "completed") return false;
  if (row.restored_at && !hasPastBrandShowcaseDeliverable(row)) return false;
  return true;
}

const PAGE_SIZE = 1000;
/** PostgREST `.in()` lists blow past URL limits around a few hundred UUIDs. */
const IN_CHUNK = 80;

/**
 * Pure aggregation: distinct non-empty brand names per influencer.
 * When `status` is present on a row, only `completed` rows are kept
 * (callers that already filtered in SQL may omit status).
 */
export function aggregatePastBrands(rows: ProposalBrandRow[]): Map<string, string[]> {
  const lists = new Map<string, string[]>();
  const seen = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!includeRowInPastBrands(row)) continue;
    const id = row.influencer_id != null ? String(row.influencer_id).trim() : "";
    if (!id) continue;
    const name = typeof row.brand_name === "string" ? row.brand_name.trim() : "";
    if (!name) continue;

    let set = seen.get(id);
    if (!set) {
      set = new Set();
      seen.set(id, set);
      lists.set(id, []);
    }
    if (set.has(name)) continue;
    set.add(name);
    lists.get(id)!.push(name);
  }

  return lists;
}

const CAMPAIGN_APP_SELECT = "influencer_id, brand_campaigns ( brands ( brand_name ) )";

type CampaignApplicationBrandRow = {
  influencer_id?: string | null;
  brand_campaigns?: unknown;
};

function brandNameFromCampaignRow(row: CampaignApplicationBrandRow): string {
  const campaignRaw = row.brand_campaigns;
  const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as
    | { brands?: unknown }
    | null
    | undefined;
  if (!campaign || typeof campaign !== "object") return "";
  const brandsRaw = campaign.brands;
  const brand = (Array.isArray(brandsRaw) ? brandsRaw[0] : brandsRaw) as
    | { brand_name?: string | null }
    | null
    | undefined;
  const name = brand?.brand_name;
  return typeof name === "string" ? name.trim() : "";
}

function flattenApprovedCampaignRows(rows: CampaignApplicationBrandRow[]): ProposalBrandRow[] {
  const out: ProposalBrandRow[] = [];
  for (const row of rows) {
    const id = row.influencer_id != null ? String(row.influencer_id).trim() : "";
    if (!id) continue;
    const name = brandNameFromCampaignRow(row);
    if (!name) continue;
    out.push({ influencer_id: id, brand_name: name });
  }
  return out;
}

async function fetchApprovedCampaignBrandRows(
  admin: SupabaseClient,
  ids: string[]
): Promise<ProposalBrandRow[]> {
  const all: ProposalBrandRow[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    let from = 0;
    for (;;) {
      const { data, error } = await admin
        .from("campaign_applications")
        .select(CAMPAIGN_APP_SELECT)
        .eq("status", "accepted")
        .eq("deliverable_status", "approved")
        .in("influencer_id", chunk)
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const batch = flattenApprovedCampaignRows((data || []) as CampaignApplicationBrandRow[]);
      all.push(...batch);
      if ((data || []).length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }
  return all;
}

async function fetchAllApprovedCampaignBrandRows(admin: SupabaseClient): Promise<ProposalBrandRow[]> {
  const all: ProposalBrandRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from("campaign_applications")
      .select(CAMPAIGN_APP_SELECT)
      .eq("status", "accepted")
      .eq("deliverable_status", "approved")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const raw = (data || []) as CampaignApplicationBrandRow[];
    all.push(...flattenApprovedCampaignRows(raw));
    if (raw.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

async function fetchCompletedBrandRows(
  admin: SupabaseClient,
  ids: string[]
): Promise<ProposalBrandRow[]> {
  const all: ProposalBrandRow[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK);
    let from = 0;
    for (;;) {
      const { data, error } = await admin
        .from("proposals")
        .select(
          "influencer_id, brand_name, status, restored_at, published_post_url, delivery_confirmed_at, auto_completed_at"
        )
        .eq("status", "completed")
        .in("influencer_id", chunk)
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const batch = (data || []) as ProposalBrandRow[];
      all.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }
  return all;
}

/**
 * Every completed proposal collaboration and approved campaign deliverable → brand names by influencer.
 * Prefer this over `.in(every approved id)` when the directory badge filter
 * needs past_brands for the whole catalog (far fewer rows than creators).
 */
export async function getAllPastBrands(client?: SupabaseClient): Promise<Map<string, string[]>> {
  const admin = await resolveClient(client);
  const rows: ProposalBrandRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from("proposals")
      .select(
        "influencer_id, brand_name, status, restored_at, published_post_url, delivery_confirmed_at, auto_completed_at"
      )
      .eq("status", "completed")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = (data || []) as ProposalBrandRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  rows.push(...(await fetchAllApprovedCampaignBrandRows(admin)));
  return aggregatePastBrands(rows);
}

async function resolveClient(client?: SupabaseClient): Promise<SupabaseClient> {
  if (client) return client;
  // Lazy so pure helpers stay importable from node:test without next/server.
  const { supabaseService } = await import("@/lib/apiAuth");
  return supabaseService();
}

/**
 * Server-side (service role): distinct brand_name values from completed
 * proposals for one or many influencer ids. Returns a map id → string[].
 * Missing influencers get an empty array.
 */
export async function getPastBrandsByInfluencerIds(
  influencerIds: string | string[],
  client?: SupabaseClient
): Promise<Map<string, string[]>> {
  const ids = [
    ...new Set(
      (Array.isArray(influencerIds) ? influencerIds : [influencerIds])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    ),
  ];
  const result = new Map<string, string[]>();
  for (const id of ids) result.set(id, []);
  if (!ids.length) return result;

  const admin = await resolveClient(client);
  const [proposalRows, campaignRows] = await Promise.all([
    fetchCompletedBrandRows(admin, ids),
    fetchApprovedCampaignBrandRows(admin, ids),
  ]);
  const aggregated = aggregatePastBrands([...proposalRows, ...campaignRows]);
  for (const [id, brands] of aggregated) {
    result.set(id, brands);
  }
  return result;
}

/** Convenience for a single influencer. */
export async function getPastBrandsForInfluencer(
  influencerId: string,
  client?: SupabaseClient
): Promise<string[]> {
  const id = String(influencerId || "").trim();
  if (!id) return [];
  const map = await getPastBrandsByInfluencerIds(id, client);
  return map.get(id) || [];
}
