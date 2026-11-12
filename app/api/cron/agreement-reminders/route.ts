/**
 * Daily (server cron 09:05 UTC): remind the side that has not accepted the
 * agreement summary, 48–96h after the other side accepted. Once per deal.
 * Auth: Authorization: Bearer CRON_SECRET (or Vercel cron headers).
 */

import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth, cronSupabaseAdmin } from "@/lib/cronRoute";
import { runAgreementReminders } from "@/lib/agreementReminderRun";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = assertCronAuth(request);
  if (denied) return denied;

  try {
    const result = await runAgreementReminders(cronSupabaseAdmin());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
