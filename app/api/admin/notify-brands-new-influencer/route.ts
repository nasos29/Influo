import { NextRequest, NextResponse } from 'next/server';
import { rejectUnlessAdmin } from "@/lib/apiAuth";

/**
 * Brand notifications are sent weekly via /api/cron/weekly-brand-influencer-digest.
 * Kept for backward compatibility — no immediate emails on approval.
 */
export async function POST(request: NextRequest) {
  const denied = await rejectUnlessAdmin(request, { allowCronSecret: true });
  if (denied) return denied;

  return NextResponse.json({
    success: true,
    skipped: true,
    sent: 0,
    total: 0,
    message:
      'Brand emails are sent once per week (Monday digest). No immediate email was sent.',
  });
}
