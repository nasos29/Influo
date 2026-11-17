/**
 * 7-day safety net: auto-complete submitted deliveries without brand response.
 * Flag DELIVERY_AUTO_COMPLETE_ENABLED default OFF.
 * Suggested daily crontab (do not auto-add):
 *   40 7 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://www.influo.gr/api/cron/delivery-auto-complete
 */

import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth, cronSupabaseAdmin } from "@/lib/cronRoute";
import { runDeliveryAutoComplete } from "@/lib/deliveryAutoCompleteRun";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = assertCronAuth(request);
  if (denied) return denied;

  try {
    const result = await runDeliveryAutoComplete(cronSupabaseAdmin());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
