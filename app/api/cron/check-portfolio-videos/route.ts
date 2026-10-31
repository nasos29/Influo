/**
 * Unified nightly portfolio video check (existence + playability).
 * Schedule: 02:30 UTC (Hobby: once per day). Auth: Authorization: Bearer CRON_SECRET.
 *
 * One status per link: missing | unplayable | ok | unknown.
 * Missing → remove after 2 confirms ≥72h apart. Unplayable → hide after 2
 * consecutive. Timeouts, login walls, 5xx, and vm→homepage stay unknown.
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
