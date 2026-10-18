import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { notifyApplicantsCampaignRemoved } from "@/lib/campaignNotify";

export async function POST(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const campaignId = String(body.campaignId || "");
  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });

  const admin = supabaseService();
  const { data: campaign } = await admin
    .from("brand_campaigns")
    .select("id, brand_id, title")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign || campaign.brand_id !== user.id) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const { data: apps } = await admin
    .from("campaign_applications")
    .select("influencer_id, status")
    .eq("campaign_id", campaignId);
  const influencerIds = [
    ...new Set(
      (apps || [])
        .filter((row) => row.status !== "withdrawn")
        .map((row) => String(row.influencer_id))
    ),
  ];

  const { error } = await admin.from("brand_campaigns").delete().eq("id", campaignId).eq("brand_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let notified = 0;
  if (influencerIds.length) {
    notified = await notifyApplicantsCampaignRemoved({
      influencerIds,
      campaignTitle: campaign.title,
    }).catch((err) => {
      console.error("[campaign delete notify]", err);
      return 0;
    });
  }

  return NextResponse.json({ ok: true, applicants: influencerIds.length, notified });
}
