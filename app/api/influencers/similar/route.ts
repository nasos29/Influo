import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { parseStoredCategories } from "@/lib/categories";
import {
  categoryIlikeOrFilter,
  normalizePlatformList,
  pickSimilarInfluencers,
  platformsFromAccounts,
  type SimilarInfluencerRow,
} from "@/lib/similarInfluencers";
import { DIRECTORY_QUERY_COLUMNS, toPublicDirectoryCard } from "@/lib/publicInfluencer";

export const runtime = "nodejs";

function asPublicSimilarRow(row: Record<string, unknown>): SimilarInfluencerRow {
  const pub = toPublicDirectoryCard(row);
  return {
    id: String(pub.id ?? ""),
    display_name: typeof pub.display_name === "string" ? pub.display_name : null,
    profile_slug: typeof pub.profile_slug === "string" ? pub.profile_slug : null,
    avatar_url: typeof pub.avatar_url === "string" ? pub.avatar_url : null,
    category: typeof pub.category === "string" ? pub.category : null,
    accounts: Array.isArray(pub.accounts) ? (pub.accounts as SimilarInfluencerRow["accounts"]) : [],
    verified: pub.verified === true,
    analytics_verified: pub.analytics_verified === true,
    location: typeof pub.location === "string" ? pub.location : null,
    price_tier: typeof pub.price_tier === "string" ? pub.price_tier : "0",
  };
}

/**
 * Public similar-creators payload for profile pages.
 * Selects pricing columns server-side only and returns price_tier — never min_rate.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const excludeId = String(searchParams.get("excludeId") || "").trim();
    const categories = parseStoredCategories(searchParams.get("categories") || "");
    const platforms = normalizePlatformList(
      String(searchParams.get("platforms") || "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    );

    if (!excludeId) {
      return NextResponse.json({ error: "excludeId required" }, { status: 400 });
    }
    if (!categories.length && !platforms.length) {
      return NextResponse.json({ data: [] });
    }

    const admin = supabaseService();
    const columns = DIRECTORY_QUERY_COLUMNS.join(",");
    const byId = new Map<string, Record<string, unknown>>();

    const catFilter = categoryIlikeOrFilter(categories);
    if (catFilter) {
      const { data, error } = await admin
        .from("influencers")
        .select(columns)
        .eq("approved", true)
        .neq("id", excludeId)
        .or(catFilter)
        .limit(40);
      if (error) throw new Error(error.message);
      for (const row of data || []) {
        const id = String((row as { id?: unknown }).id ?? "");
        if (id) byId.set(id, row as unknown as Record<string, unknown>);
      }
    }

    // Extra pool so same-platform creators can fill after category matches.
    if (byId.size < 24 && platforms.length > 0) {
      const { data, error } = await admin
        .from("influencers")
        .select(columns)
        .eq("approved", true)
        .neq("id", excludeId)
        .limit(80);
      if (error) throw new Error(error.message);
      for (const row of data || []) {
        const rec = row as unknown as Record<string, unknown>;
        const id = String(rec.id ?? "");
        if (!id || byId.has(id)) continue;
        if (!platformsFromAccounts(rec.accounts).some((p) => platforms.includes(p))) continue;
        byId.set(id, rec);
      }
    }

    const publicRows = [...byId.values()].map(asPublicSimilarRow);
    const picked = pickSimilarInfluencers(
      excludeId,
      categories,
      publicRows,
      8,
      undefined,
      platforms
    );

    return NextResponse.json(
      { data: picked },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (err: unknown) {
    console.error("[API /api/influencers/similar]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
