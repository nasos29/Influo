import { NextRequest, NextResponse } from "next/server";
import { isBrandUser, userFromBearer } from "@/lib/apiAuth";
import { loadInfluencerRows } from "@/lib/loadPublicInfluencers";
import { COMMERCIAL_QUERY_COLUMNS, toCommercialInfluencer } from "@/lib/publicInfluencer";

/**
 * Exact prices for one approved influencer.
 * Only a logged-in brand (the same check the profile uses before showing prices).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await userFromBearer(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isBrandUser(user))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const rows = await loadInfluencerRows(COMMERCIAL_QUERY_COLUMNS, { id });
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(
      { data: toCommercialInfluencer(row) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err: unknown) {
    console.error("[API /api/influencers/commercial]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
