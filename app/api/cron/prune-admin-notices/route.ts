/**
 * Daily: delete read admin_notices older than 5 days. Unread rows are never deleted.
 * Auth: Authorization: Bearer CRON_SECRET (or Vercel cron headers).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pruneOldReadAdminNotices } from "@/lib/pruneAdminNotices";
import { getSiteSetting } from "@/lib/siteSettingsServer";

export const runtime = "nodejs";
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function assertCronAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const isVercelCron =
    request.headers.get("x-vercel-cron") === "1" ||
    request.headers.get("user-agent")?.includes("vercel-cron");

  if (cronSecret) {
    if (auth !== `Bearer ${cronSecret}` && !isVercelCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (!isVercelCron) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = assertCronAuth(request);
  if (denied) return denied;

  try {
    const retentionDays = await getSiteSetting("admin_notice_read_retention_days");
    const deleted = await pruneOldReadAdminNotices(supabaseAdmin, retentionDays);
    return NextResponse.json({
      ok: true,
      deleted,
      retentionDays,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
