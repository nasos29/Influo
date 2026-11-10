import { NextRequest, NextResponse } from "next/server";
import { userFromBearer } from "@/lib/apiAuth";

export const maxDuration = 60;

/**
 * Legacy client call after publishing — neutralized (Q3).
 * Notifications are sent once server-side by /api/campaigns/save with durable
 * campaign_notify_log dedupe. This route stays so older clients get 200 instead of 404.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await userFromBearer(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as { campaignId?: string };
    const campaignId = typeof body.campaignId === "string" ? body.campaignId : "";
    if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
    return NextResponse.json({ ok: true, skipped: "server_side_only" });
  } catch (e: unknown) {
    console.error("[push/campaign-published]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
