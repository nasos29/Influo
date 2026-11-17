/**
 * Creator deliverable reminders + brand approve reminders.
 * Flags default OFF (DELIVERABLE_REMINDERS_ENABLED / BRAND_APPROVE_REMINDERS_ENABLED).
 * Suggested daily crontab (do not auto-add):
 *   20 7 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://www.influo.gr/api/cron/delivery-reminders
 */

import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth, cronSupabaseAdmin } from "@/lib/cronRoute";
import { runDeliverableReminders } from "@/lib/deliverableReminderRun";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = assertCronAuth(request);
  if (denied) return denied;

  try {
    const result = await runDeliverableReminders(cronSupabaseAdmin());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
