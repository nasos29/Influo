import { NextResponse } from "next/server";
import { loadInfluencerRows } from "@/lib/loadPublicInfluencers";
import { getPastBrandsByInfluencerIds } from "@/lib/pastBrands";
import { DIRECTORY_QUERY_COLUMNS, toPublicDirectoryCard } from "@/lib/publicInfluencer";

export async function GET() {
  try {
    const rows = await loadInfluencerRows(DIRECTORY_QUERY_COLUMNS);
    const pastById = await getPastBrandsByInfluencerIds(rows.map((row) => String(row.id ?? "")));
    return NextResponse.json(
      {
        data: rows.map((row) => ({
          ...toPublicDirectoryCard(row),
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
    console.error("[API /api/influencers/public] Exception:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
