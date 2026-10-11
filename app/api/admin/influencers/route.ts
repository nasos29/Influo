import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, supabaseService } from "@/lib/apiAuth";

/**
 * Full influencer rows for the admin dashboard.
 * Service role on the server, after an admin session check.
 * The browser must not select private columns of other people.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pageSize = 1000;
    const influencers: Record<string, unknown>[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseService()
        .from("influencers")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const rows = (data || []) as Record<string, unknown>[];
      influencers.push(...rows);
      if (rows.length < pageSize) break;
    }
    return NextResponse.json(
      { influencers },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
