import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/lib/apiAuth";
import { notifyCampaignPublished } from "@/lib/campaignPublishedNotify";

export const maxDuration = 60;

/** Admin/cron only: (re)send the "campaign published" notifications for one open campaign. */
export async function POST(req: NextRequest) {
  const denied = await rejectUnlessAdmin(req, { allowCronSecret: true });
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { campaignId?: string };
  if (!body.campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });
  const result = await notifyCampaignPublished(body.campaignId, { force: true });
  return NextResponse.json(result, { status: "status" in result ? result.status : 200 });
}
