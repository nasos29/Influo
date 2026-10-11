import { NextRequest, NextResponse } from "next/server";
import { loadInfluencerRows } from "@/lib/loadPublicInfluencers";
import { PROFILE_QUERY_COLUMNS, toPublicProfile } from "@/lib/publicInfluencer";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const rows = await loadInfluencerRows(PROFILE_QUERY_COLUMNS, { id });
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ data: toPublicProfile(row) });
  } catch (err: unknown) {
    console.error("[API /api/influencers/public/:id]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
