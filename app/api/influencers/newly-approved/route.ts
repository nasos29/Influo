/**
 * Newly approved influencers for the homepage (last 8).
 * Same public allow-list as the directory, plus the media the cards display.
 */

import { NextResponse } from "next/server";
import { loadInfluencerRows } from "@/lib/loadPublicInfluencers";
import { NEWLY_APPROVED_QUERY_COLUMNS, toPublicNewlyApproved } from "@/lib/publicInfluencer";

const LIMIT = 8;

export async function GET() {
  try {
    const rows = await loadInfluencerRows(NEWLY_APPROVED_QUERY_COLUMNS, {
      newestFirst: true,
      limit: LIMIT,
    });
    return NextResponse.json({ influencers: rows.map(toPublicNewlyApproved) });
  } catch (err: unknown) {
    console.error("[newly-approved] Exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error", influencers: [] },
      { status: 200 }
    );
  }
}
