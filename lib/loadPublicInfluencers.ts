import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseService } from "@/lib/apiAuth";

type Filter = {
  id?: string;
  slug?: string;
  limit?: number;
  newestFirst?: boolean;
};

function missingColumn(message: string): string | null {
  const quoted = message.match(/'([A-Za-z0-9_]+)' column/i);
  if (quoted?.[1]) return quoted[1];
  const qualified = message.match(/column [\w"]+\.([A-Za-z0-9_]+) does not exist/i);
  if (qualified?.[1]) return qualified[1];
  const couldNot = message.match(/Could not find the '([A-Za-z0-9_]+)' column/i);
  if (couldNot?.[1]) return couldNot[1];
  return null;
}

/**
 * Selects an explicit column list. If the database does not have one of the
 * optional columns yet, that column is dropped and the query is retried.
 */
export async function loadInfluencerRows(
  columns: readonly string[],
  filter: Filter = {},
  client?: SupabaseClient
): Promise<Record<string, unknown>[]> {
  const admin = client ?? supabaseService();
  let remaining = [...new Set(columns)];

  for (let attempt = 0; attempt < 12; attempt++) {
    if (remaining.length === 0) {
      throw new Error("No influencer columns left to select");
    }
    let query = admin.from("influencers").select(remaining.join(",")).eq("approved", true);
    if (filter.id) query = query.eq("id", filter.id);
    if (filter.slug) query = query.eq("profile_slug", filter.slug);
    if (filter.newestFirst) query = query.order("created_at", { ascending: false });
    if (filter.limit) query = query.limit(filter.limit);

    const { data, error } = await query;
    if (!error) return (data || []) as unknown as Record<string, unknown>[];

    const column = missingColumn(error.message || "");
    if (!column || !remaining.includes(column)) {
      throw new Error(error.message);
    }
    remaining = remaining.filter((name) => name !== column);
  }

  throw new Error("Could not load influencers");
}
