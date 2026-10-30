/**
 * Newly approved influencers for the homepage (last 8).
 * Same public allow-list as the directory, plus the media the cards display.
 */

import { NextResponse } from "next/server";
import { loadInfluencerRows } from "@/lib/loadPublicInfluencers";
import { getPastBrandsByInfluencerIds } from "@/lib/pastBrands";
import { NEWLY_APPROVED_QUERY_COLUMNS, toPublicNewlyApproved } from "@/lib/publicInfluencer";

const LIMIT = 8;

export async function GET() {
  try {
    const rows = await loadInfluencerRows(NEWLY_APPROVED_QUERY_COLUMNS, {
      newestFirst: true,
      limit: LIMIT,
    });
    const pastById = await getPastBrandsByInfluencerIds(rows.map((row) => String(row.id ?? "")));
    return NextResponse.json(
      {
        influencers: rows.map((row) => ({
          ...toPublicNewlyApproved(row),
          past_brands: pastById.get(String(row.id ?? "")) || [],
        })),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err: unknown) {
    console.error("[newly-approved] Exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error", influencers: [] },
      { status: 200 }
    );
  }
}
