import { NextRequest, NextResponse } from "next/server";
import { getPastBrandsByInfluencerIds } from "@/lib/pastBrands";

const MAX_IDS = 300;

/**
 * Distinct completed-proposal brand names per influencer.
 * Used by brand dashboard recommendations (client cannot use service role).
 */
export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get("ids") || "";
    const ids = [
      ...new Set(
        raw
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      ),
    ].slice(0, MAX_IDS);

    if (!ids.length) {
      return NextResponse.json({ data: {} as Record<string, string[]> });
    }

    const map = await getPastBrandsByInfluencerIds(ids);
    const data: Record<string, string[]> = {};
    for (const [id, brands] of map) data[id] = brands;
    return NextResponse.json({ data });
  } catch (err: unknown) {
    console.error("[API /api/influencers/past-brands]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
