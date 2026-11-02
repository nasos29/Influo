import { NextResponse } from "next/server";

/**
 * Legacy endpoint. New-application notifications (brand email + push, creator confirmation)
 * are sent server-side by POST /api/campaigns/application after the save. Browsers still
 * running an older bundle may call this; it sends nothing so nobody gets a second copy.
 */
export async function POST() {
  return NextResponse.json({ ok: true, skipped: true, reason: "sent_server_side" });
}
