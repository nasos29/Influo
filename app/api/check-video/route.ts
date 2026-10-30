import { NextRequest, NextResponse } from "next/server";
import { checkVideoPlayable } from "@/lib/checkVideoPlayable";

/** Simple in-memory rate limit: 30 requests / IP / minute. */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") || "unknown";
}

function allowRequest(ip: string): boolean {
  const now = Date.now();
  const row = hits.get(ip);
  if (!row || now >= row.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (row.count >= MAX_PER_WINDOW) return false;
  row.count += 1;
  return true;
}

// Opportunistic cleanup so the map does not grow forever in long-lived workers.
function maybePruneHits() {
  if (hits.size < 500) return;
  const now = Date.now();
  for (const [ip, row] of hits) {
    if (now >= row.resetAt) hits.delete(ip);
  }
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  maybePruneHits();
  if (!allowRequest(ip)) {
    return NextResponse.json(
      { error: "Too many requests", playable: true, reason: "unchecked" },
      { status: 429, headers: { "Cache-Control": "private, max-age=0", "Retry-After": "60" } }
    );
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url || !String(url).trim()) {
    return NextResponse.json(
      { error: "URL parameter is required", playable: false },
      { status: 400, headers: { "Cache-Control": "private, max-age=0" } }
    );
  }

  try {
    const result = await checkVideoPlayable(String(url).trim());
    const res = NextResponse.json(result);
    res.headers.set("Cache-Control", "private, max-age=0");
    return res;
  } catch (e) {
    console.error("[check-video]", e);
    return NextResponse.json(
      { playable: true, reason: "unchecked" },
      { headers: { "Cache-Control": "private, max-age=0" } }
    );
  }
}
