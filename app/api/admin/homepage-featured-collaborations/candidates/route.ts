import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/lib/apiAuth";
import { loadFeaturedCollaborationCandidates } from "@/lib/loadFeaturedCollaborationCandidates";

export const runtime = "nodejs";

/** Admin: collaborations with ready self-hosted video (for brand_cta showcase slots). */
export async function GET(request: NextRequest) {
  const denied = await rejectUnlessAdmin(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.min(200, Math.max(1, Number.parseInt(limitRaw, 10) || 120)) : 120;
  const items = await loadFeaturedCollaborationCandidates(limit);
  return NextResponse.json({ items });
}