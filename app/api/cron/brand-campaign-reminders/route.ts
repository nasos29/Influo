/**
 * Brand campaign reminders (draft / no-campaign nudge / target & closed events).
 * Quiet window enforced in runner: 10:00–19:00 Europe/Athens.
 * Auth: Authorization: Bearer CRON_SECRET (or Vercel cron headers).
 *
 * Query: ?dry_run=1 — list who would get what (no send / no log writes).
 * Env: BRAND_CAMPAIGN_REMINDERS_ENABLED (default OFF), BRAND_CAMPAIGN_REMINDERS_LIVE
 * (default OFF → all mail redirected to test recipient).
 *
 * Suggested server crontab (UTC; 08:15 ≈ 10:15 Athens in winter):
 *   15 8 * * * /opt/influo/cron-run.sh /api/cron/brand-campaign-reminders
 * Do NOT install on the server from this PR alone — document only.
 */

import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth, cronSupabaseAdmin } from "@/lib/cronRoute";
import { runBrandCampaignReminders } from "@/lib/brandCampaignRemindersRun";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const denied = assertCronAuth(request);
  if (denied) return denied;

  const dryRun =
    request.nextUrl.searchParams.get("dry_run") === "1" ||
    request.nextUrl.searchParams.get("dryRun") === "1";

  try {
    const result = await runBrandCampaignReminders(cronSupabaseAdmin(), { dryRun });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("[brand-campaign-reminders]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
