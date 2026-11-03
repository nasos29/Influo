import { NextRequest, NextResponse } from "next/server";
import { extraBadgesFor } from "@/lib/extraBadges";

/** Behaviour badges for one creator (served from the in-process cache). */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ badges: [] });
  const badges = await extraBadgesFor(id);
  return NextResponse.json({ badges }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
