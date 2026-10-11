import { NextResponse } from "next/server";
import { loadInfluencerRows } from "@/lib/loadPublicInfluencers";
import { DIRECTORY_QUERY_COLUMNS, toPublicDirectoryCard } from "@/lib/publicInfluencer";

export async function GET() {
  try {
    const rows = await loadInfluencerRows(DIRECTORY_QUERY_COLUMNS);
    return NextResponse.json({ data: rows.map(toPublicDirectoryCard) });
  } catch (err: unknown) {
    console.error("[API /api/influencers/public] Exception:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
