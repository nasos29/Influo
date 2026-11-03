import { NextRequest, NextResponse, after } from "next/server";
import { userFromBearer } from "@/lib/apiAuth";
import { notifyCampaignPublished } from "@/lib/campaignPublishedNotify";

export const maxDuration = 60;

/**
 * Legacy client call after publishing. Notifications are now sent server-side by
 * /api/campaigns/save; this stays as a backup and is de-duplicated per opening.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await userFromBearer(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as { campaignId?: string };
    const campaignId = typeof body.campaignId === "string" ? body.campaignId : "";
    if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
    after(() =>
      notifyCampaignPublished(campaignId, { ownerId: user.id }).catch((err) => {
        console.error("[push/campaign-published]", err);
      })
    );
    return NextResponse.json({ ok: true, queued: true });
  } catch (e: unknown) {
    console.error("[push/campaign-published]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
