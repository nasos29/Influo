import { NextRequest, NextResponse } from "next/server";
import { getBrandBadgeMap } from "@/lib/brandBadges";

/** Brand badges for up to 100 brand ids (?ids=a,b) from the in-process cache. `?stats=1` returns counts only. */
export async function GET(request: NextRequest) {
  const map = await getBrandBadgeMap();
  const headers = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" };
  if (request.nextUrl.searchParams.get("stats") === "1") {
    const counts: Record<string, number> = { new_brand: 0, frequent_partner: 0 };
    for (const list of map.values()) for (const b of list) counts[b] = (counts[b] || 0) + 1;
    return NextResponse.json({ counts }, { headers });
  }
  const ids = (request.nextUrl.searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s))
    .slice(0, 100);
  const badges: Record<string, string[]> = {};
  for (const id of ids) {
    const b = map.get(id);
    if (b) badges[id] = b;
  }
  return NextResponse.json({ badges }, { headers });
}
