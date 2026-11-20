import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { mediaFromRow, type HostedMedia } from "@/lib/creatorMedia";

export const dynamic = "force-dynamic";

/**
 * Public read of ready self-hosted videos for one creator.
 * Used by the profile client so ISR/CDN stale HTML still gets current play URLs.
 */
export async function GET(request: NextRequest) {
  const influencerId = request.nextUrl.searchParams.get("influencerId")?.trim() || "";
  if (!influencerId) {
    return NextResponse.json({ error: "influencerId required" }, { status: 400 });
  }

  const supabase = supabaseService();
  const { data, error } = await supabase
    .from("creator_media")
    .select(
      "source_url, kind, folder_path, media_type, metadata, play_path, av1_path, hevc_path, poster_path, duration_ms, width, height, status"
    )
    .eq("influencer_id", influencerId)
    .eq("status", "ready");

  if (error) {
    return NextResponse.json({ error: "lookup failed" }, { status: 500 });
  }

  const media: HostedMedia[] = [];
  for (const row of data || []) {
    const item = mediaFromRow(row);
    if (item) media.push(item);
  }
  return NextResponse.json({ media });
}
