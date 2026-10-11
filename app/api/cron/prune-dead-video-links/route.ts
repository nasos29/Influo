/**
 * Nightly pass over influencer video links.
 * Vercel schedule is 01:00 UTC (03:00 Athens in winter, 04:00 in summer).
 * Auth matches the other /api/cron routes: Authorization: Bearer CRON_SECRET.
 *
 * Each run checks a small batch and saves a cursor. A link is removed only
 * after two "missing" results at least 72 hours apart. Timeouts, rate limits,
 * 5xx, and login walls stay "unknown" and are never removed.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runPruneDeadVideoLinks } from "@/lib/pruneDeadVideoLinks";

export const runtime = "nodejs";
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function assertCronAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = assertCronAuth(request);
  if (denied) return denied;

  try {
    const summary = await runPruneDeadVideoLinks(supabaseAdmin);
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    const status = message.includes("VIDEO_LINK_CHECKS.sql") ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
