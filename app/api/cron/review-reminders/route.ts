/**
 * Daily: after publish_deadline (or 14 days from agreement) ask brands to review.
 * Auth: Authorization: Bearer CRON_SECRET (or Vercel cron headers).
 */

import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth, cronSupabaseAdmin } from "@/lib/cronRoute";
import { runReviewReminders } from "@/lib/reviewReminderRun";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = assertCronAuth(request);
  if (denied) return denied;

  try {
    const result = await runReviewReminders(cronSupabaseAdmin());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
