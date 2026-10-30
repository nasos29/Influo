import { NextRequest, NextResponse } from "next/server";
import { loadInfluencerRows } from "@/lib/loadPublicInfluencers";
import { getPastBrandsForInfluencer } from "@/lib/pastBrands";
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

    const past_brands = await getPastBrandsForInfluencer(String(row.id ?? id));
    return NextResponse.json(
      { data: { ...toPublicProfile(row), past_brands } },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err: unknown) {
    console.error("[API /api/influencers/public/:id]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
