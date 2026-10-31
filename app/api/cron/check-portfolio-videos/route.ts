/**
 * Nightly portfolio video playability check.
 * Schedule: 02:30 UTC (Hobby: once per day). Auth: Authorization: Bearer CRON_SECRET.
 *
 * Uses checkVideoPlayable (same logic as /api/check-video). Hides links in
 * hidden_videos only after 2 consecutive unplayable results. Never deletes
 * from videos. No Gemini.
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
    const status = message.includes("PORTFOLIO_VIDEO_CHECKS.sql") ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
