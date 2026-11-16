/**
 * Daily: 3 days after publish_deadline EOD (or 3 days after agreement) —
 * remind each side to leave a review (one stamp / deal; skip side if already reviewed,
 * declined prompts, or opted out of reminder emails via notification prefs).
 * Optional second wave (7 days after first) only when REVIEW_REMINDER_SECOND_WAVE=1.
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
