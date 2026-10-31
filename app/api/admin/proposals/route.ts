import { NextResponse } from "next/server";
import { requireAdmin, supabaseService } from "@/lib/apiAuth";
import { ilikePattern, pageBounds, parsePositiveInt, sevenDaysAgoIso } from "@/lib/adminPaging";

const LIST_COLUMNS =
  "id, created_at, brand_name, budget, service_type, status, influencer_id, influencers(display_name)";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const STATUSES = new Set(["pending", "accepted", "completed", "rejected", "cancelled", "canceled"]);

function influencerName(row: Record<string, unknown>): string {
  const raw = row.influencers;
  const one = Array.isArray(raw) ? raw[0] : raw;
  if (one && typeof one === "object" && typeof (one as { display_name?: unknown }).display_name === "string") {
    return (one as { display_name: string }).display_name;
  }
  return "";
}

/**
 * Admin proposal list. One page plus cheap counts — not every row.
 * Does not change proposal status.
 */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const db = supabaseService();
    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      parsePositiveInt(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE)
    );
    const q = (url.searchParams.get("q") || "").trim();
    const status = (url.searchParams.get("status") || "all").toLowerCase();
    const since = sevenDaysAgoIso();
    const { from, to } = pageBounds(page, pageSize);

    let influencerIds: Array<string | number> = [];
    if (q) {
      const { data: matches } = await db
        .from("influencers")
        .select("id")
        .ilike("display_name", ilikePattern(q))
        .limit(30);
      influencerIds = (matches || []).map((row) => row.id as string | number);
    }

    let listQuery = db
      .from("proposals")
      .select(LIST_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (STATUSES.has(status)) listQuery = listQuery.eq("status", status);

    if (q) {
      const pattern = ilikePattern(q);
      const parts = [
        `brand_name.ilike.${pattern}`,
        `service_type.ilike.${pattern}`,
        `brand_email.ilike.${pattern}`,
      ];
      if (influencerIds.length) {
        parts.push(`influencer_id.in.(${influencerIds.join(",")})`);
      }
      listQuery = listQuery.or(parts.join(","));
    }

    const pipelineQuery =
      !q && status === "all" && page === 1
        ? db.from("proposals").select("budget").in("status", ["pending", "accepted", "completed"]).limit(2000)
        : Promise.resolve({ data: null, error: null });

    const [
      listResult,
      totalCount,
      pendingCount,
      acceptedCount,
      completedCount,
      recentCount,
      attentionResult,
      pendingIdsResult,
      pipelineResult,
    ] = await Promise.all([
      listQuery,
      db.from("proposals").select("id", { count: "exact", head: true }),
      db.from("proposals").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("proposals").select("id", { count: "exact", head: true }).eq("status", "accepted"),
      db.from("proposals").select("id", { count: "exact", head: true }).eq("status", "completed"),
      db.from("proposals").select("id", { count: "exact", head: true }).gte("created_at", since),
      db
        .from("proposals")
        .select("id, brand_name, budget, created_at, status, influencers(display_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5),
      db.from("proposals").select("id").eq("status", "pending").order("created_at", { ascending: false }).limit(200),
      pipelineQuery,
    ]);

    if (listResult.error) {
      return NextResponse.json({ error: listResult.error.message }, { status: 500 });
    }

    let pipeline: number | null = null;
    if (pipelineResult && !pipelineResult.error && Array.isArray(pipelineResult.data)) {
      pipeline = 0;
      for (const row of pipelineResult.data) {
        const value = parseFloat(String((row as { budget?: unknown }).budget ?? ""));
        if (!Number.isNaN(value)) pipeline += value;
      }
    }

    const rows = ((listResult.data || []) as Record<string, unknown>[]).map((row) => ({
      ...row,
      influencer_name: influencerName(row),
    }));
    const attention = ((attentionResult.data || []) as Record<string, unknown>[]).map((row) => ({
      id: row.id,
      brand_name: row.brand_name,
      budget: row.budget,
      created_at: row.created_at,
      influencer_name: influencerName(row),
    }));

    const total = listResult.count ?? 0;

    return NextResponse.json(
      {
        success: true,
        proposals: rows,
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total,
        counts: {
          total: totalCount.count ?? 0,
          pending: pendingCount.count ?? 0,
          accepted: acceptedCount.count ?? 0,
          completed: completedCount.count ?? 0,
          active: (acceptedCount.count ?? 0) + (completedCount.count ?? 0),
          recent: recentCount.count ?? 0,
          ...(pipeline != null ? { pipeline } : {}),
        },
        attention,
        pendingIds: (pendingIdsResult.data || [])
          .map((row) => Number(row.id))
          .filter((id) => Number.isFinite(id)),
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load proposals";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
