import { NextResponse } from "next/server";
import { requireAdmin, supabaseService } from "@/lib/apiAuth";

const PAGE = 1000;
const MAX_ROWS = 5000;

/**
 * Admin-only list of every proposal. Service role bypasses participant RLS.
 * Does not change proposal status.
 */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = supabaseService();
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const to = Math.min(from + PAGE, MAX_ROWS) - 1;
      const { data, error } = await db
        .from("proposals")
        .select(
          "id, created_at, brand_name, brand_email, budget, service_type, status, influencer_id, message, counter_proposal_status, counter_proposal_budget, influencer_agreement_accepted, brand_agreement_accepted, influencers(display_name)"
        )
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const batch = (data || []) as Record<string, unknown>[];
      rows.push(...batch);
      if (batch.length < to - from + 1) break;
    }
    return NextResponse.json({ success: true, proposals: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load proposals";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
