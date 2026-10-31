/**
 * Compatibility endpoint — same unified logic as /api/cron/check-portfolio-videos.
 * Removed from vercel.json; kept so manual / legacy callers still work.
 * Auth: Authorization: Bearer CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runCheckPortfolioVideos } from "@/lib/checkPortfolioVideos";

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
    const summary = await runCheckPortfolioVideos(supabaseAdmin);
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    const status =
      message.includes("VIDEO_LINK_CHECKS.sql") || message.includes("PORTFOLIO_VIDEO_CHECKS.sql")
        ? 503
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
