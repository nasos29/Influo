/**
 * Daily admin digest of campaign applications (when ADMIN_APPLICATION_DIGEST_ENABLED=1).
 * Auth: Bearer CRON_SECRET. Default flag OFF → no-op.
 */

import { NextRequest, NextResponse } from "next/server";
import { flushAdminApplicationDigest } from "@/lib/adminApplicationDigest";

export const maxDuration = 60;

function assertCronAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = assertCronAuth(request);
  if (denied) return denied;
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const result = await flushAdminApplicationDigest({ dryRun });
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
