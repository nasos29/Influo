/**
 * Periodically delete temporary Zoho mailing lists after selected-recipient
 * campaigns finish sending (Sent + emails_sent_count), or after max age.
 * Auth: Authorization: Bearer CRON_SECRET (or Vercel cron headers).
 */

import { NextRequest, NextResponse } from "next/server";
import { processZohoTempListCleanup } from "@/lib/zohoTempListCleanup";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    const result = await processZohoTempListCleanup();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
