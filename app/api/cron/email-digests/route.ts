/**
 * Flush brand application digests (~3h) and admin daily digest (~09:30 Europe/Athens).
 * Also drains legacy JSON admin-application-digest when that flag is on.
 * Auth: Bearer CRON_SECRET.
 * Suggested crontab (do not auto-add): every 15 minutes
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://www.influo.gr/api/cron/email-digests
 */

import { NextRequest, NextResponse } from "next/server";
import { flushAdminApplicationDigest } from "@/lib/adminApplicationDigest";
import { flushAdminDailyDigest } from "@/lib/adminDailyDigest";
import { flushBrandApplicationDigests } from "@/lib/brandApplicationDigest";
import { assertCronAuth, cronSupabaseAdmin } from "@/lib/cronRoute";
import { isAdminDailyDigestEnabled } from "@/lib/emailDigestFlags";
import { isAdminApplicationDigestEnabled } from "@/lib/zohoBulkMailFlags";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = assertCronAuth(request);
  if (denied) return denied;

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const force = request.nextUrl.searchParams.get("force") === "1";
  const admin = cronSupabaseAdmin();

  try {
    const brand = await flushBrandApplicationDigests(admin, { dryRun });
    const daily = await flushAdminDailyDigest(admin, { dryRun, force });

    // Legacy file-based application digest (only when daily DB digest is off).
    let legacyApps: { sent: boolean; count: number; skipped: boolean; reason?: string } = {
      sent: false,
      count: 0,
      skipped: true,
      reason: "skipped",
    };
    if (isAdminApplicationDigestEnabled() && !isAdminDailyDigestEnabled()) {
      legacyApps = await flushAdminApplicationDigest({ dryRun });
    }

    return NextResponse.json({
      ok: true,
      brand,
      adminDaily: daily,
      legacyAdminApplications: legacyApps,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
