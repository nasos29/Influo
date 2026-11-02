import { NextRequest, NextResponse } from "next/server";
import { isAllowedTopPostUrl } from "@/lib/topPosts";
import { unavailableTopPostUrls } from "@/lib/topPostsAvailability";

export const dynamic = "force-dynamic";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, { count: number; resetAt: number }>();

function allow(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 1000) for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k);
  const row = hits.get(ip);
  if (!row || now >= row.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (row.count >= MAX_PER_WINDOW) return false;
  row.count += 1;
  return true;
}

/** GET ?u=<url>&u=<url> (max 9) → { unavailable: string[] } */
export async function GET(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  if (!allow(ip)) return NextResponse.json({ unavailable: [] }, { status: 429 });
  const urls = Array.from(new Set(req.nextUrl.searchParams.getAll("u"))).filter(isAllowedTopPostUrl).slice(0, 9);
  const unavailable = urls.length ? await unavailableTopPostUrls(urls) : [];
  return NextResponse.json({ unavailable }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
