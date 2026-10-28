import type { SupabaseClient } from "@supabase/supabase-js";

export type ProposalBrandRow = {
  influencer_id?: string | null;
  brand_name?: string | null;
  status?: string | null;
};

const PAGE_SIZE = 1000;

/**
 * Pure aggregation: distinct non-empty brand names per influencer.
 * When `status` is present on a row, only `completed` rows are kept
 * (callers that already filtered in SQL may omit status).
 */
export function aggregatePastBrands(rows: ProposalBrandRow[]): Map<string, string[]> {
  const lists = new Map<string, string[]>();
  const seen = new Map<string, Set<string>>();

  for (const row of rows) {
    if (row.status != null) {
      const status = String(row.status).trim().toLowerCase();
      if (status !== "completed") continue;
    }
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

async function fetchCompletedBrandRows(
  admin: SupabaseClient,
  ids: string[]
): Promise<ProposalBrandRow[]> {
  const all: ProposalBrandRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await admin
      .from("proposals")
      .select("influencer_id, brand_name")
      .eq("status", "completed")
      .in("influencer_id", ids)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = (data || []) as ProposalBrandRow[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
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
  const rows = await fetchCompletedBrandRows(admin, ids);
  const aggregated = aggregatePastBrands(rows);
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
