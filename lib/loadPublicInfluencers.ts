import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseService } from "@/lib/apiAuth";

type Filter = {
  id?: string;
  slug?: string;
  limit?: number;
  newestFirst?: boolean;
};

type BuiltQuery = {
  data: unknown[] | null;
  error: { message: string } | null;
  count?: number | null;
};

/**
 * Runs a select against approved influencers, dropping a column and retrying
 * when the live schema does not have it yet.
 */
export async function selectApprovedInfluencers(
  columns: readonly string[],
  run: (columnList: string) => PromiseLike<BuiltQuery>
): Promise<{ rows: Record<string, unknown>[]; total: number | null }> {
  let remaining = [...new Set(columns)];
  for (let attempt = 0; attempt < 12; attempt++) {
    if (remaining.length === 0) throw new Error("No influencer columns left to select");
    const { data, error, count } = await run(remaining.join(","));
    if (!error) {
      return {
        rows: (data || []) as Record<string, unknown>[],
        total: typeof count === "number" ? count : null,
      };
    }
    const column = missingColumn(error.message || "");
    if (!column || !remaining.includes(column)) throw new Error(error.message);
    remaining = remaining.filter((name) => name !== column);
  }
  throw new Error("Could not load influencers");
}

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
  const { rows } = await selectApprovedInfluencers(columns, (columnList) => {
    let query = admin.from("influencers").select(columnList).eq("approved", true);
    if (filter.id) query = query.eq("id", filter.id);
    if (filter.slug) query = query.eq("profile_slug", filter.slug);
    if (filter.newestFirst) query = query.order("created_at", { ascending: false });
    if (filter.limit) query = query.limit(filter.limit);
    return query;
  });
  return rows;
}
