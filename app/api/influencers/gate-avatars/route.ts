import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { supabaseService } from "@/lib/apiAuth";
import { pickGateAvatarUrls } from "@/lib/gateAvatars";

/** One small read: id + avatar only, cached for an hour. */
const loadGateAvatars = unstable_cache(
  async (): Promise<string[]> => {
    const { data, error } = await supabaseService()
      .from("influencers")
      .select("id, avatar_url")
      .eq("approved", true)
      .not("avatar_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(24);
    if (error) {
      console.error("[gate-avatars]", error.message);
      return [];
    }
    return pickGateAvatarUrls((data || []) as Array<{ avatar_url?: unknown }>);
  },
  ["gate-creator-avatars"],
  { revalidate: 3600 }
);

export async function GET() {
  try {
    const avatars = await loadGateAvatars();
    return NextResponse.json(
      { avatars },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    console.error("[gate-avatars]", error instanceof Error ? error.message : "failed");
    return NextResponse.json(
      { avatars: [] },
      { headers: { "Cache-Control": "public, s-maxage=60" } }
    );
  }
}
