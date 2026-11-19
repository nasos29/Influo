import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { ACTIVE_PROPOSAL_STATUSES, isCampaignServiceType } from "@/lib/campaignProposalIdempotency";
import { ensureConversationLink } from "@/lib/proposalChat";

function titleNeedle(title: string): string {
  const t = title.trim();
  if (t.length < 4) return t;
  return t.slice(0, 80);
}

export async function POST(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const applicationId = String(body.applicationId || "").trim();
  if (!applicationId) {
    return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
  }

  const admin = supabaseService();
  const { data: app, error: appErr } = await admin
    .from("campaign_applications")
    .select(
      "id, influencer_id, status, brand_campaigns ( id, title, brand_id, brands ( brand_name, contact_email ) )"
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (appErr || !app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (String(app.status || "").toLowerCase() !== "accepted") {
    return NextResponse.json({ error: "not_accepted" }, { status: 403 });
  }

  const { data: influencer } = await admin
    .from("influencers")
    .select("id, auth_user_id, contact_email")
    .eq("id", app.influencer_id)
    .maybeSingle();
  if (!influencer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userEmail = (user.email || "").trim().toLowerCase();
  const owns =
    influencer.auth_user_id === user.id ||
    (!influencer.auth_user_id &&
      !!userEmail &&
      (influencer.contact_email || "").trim().toLowerCase() === userEmail);
  if (!owns) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const campaignRaw = app.brand_campaigns as unknown;
  const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as {
    id?: string;
    title?: string;
    brand_id?: string;
    brands?: { brand_name?: string; contact_email?: string } | { brand_name?: string; contact_email?: string }[] | null;
  } | null;
  const brandRow = Array.isArray(campaign?.brands) ? campaign?.brands[0] : campaign?.brands;
  const brandEmail = (brandRow?.contact_email || "").trim().toLowerCase();
  const brandName = brandRow?.brand_name || "Επιχείρηση";
  if (!brandEmail.includes("@")) {
    return NextResponse.json({ error: "Brand contact missing" }, { status: 400 });
  }

  const { data: existingConv } = await admin
    .from("conversations")
    .select("id")
    .eq("influencer_id", app.influencer_id)
    .ilike("brand_email", brandEmail)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (existingConv?.id) {
    return NextResponse.json({ success: true, conversationId: existingConv.id });
  }

  const campaignTitle = campaign?.title || "Καμπάνια";
  const brandId = campaign?.brand_id || "";
  let proposalId: string | number | null = null;
  const needle = titleNeedle(campaignTitle);
  if (needle) {
    let pq = admin
      .from("proposals")
      .select("id, service_type, brand_id, created_at")
      .eq("influencer_id", app.influencer_id)
      .ilike("service_type", `%${needle.replace(/%/g, "\\%")}%`)
      .in("status", [...ACTIVE_PROPOSAL_STATUSES, "completed"])
      .order("created_at", { ascending: true })
      .limit(30);
    if (brandId) pq = pq.eq("brand_id", brandId);
    const { data: proposals } = await pq;
    for (const row of proposals || []) {
      if (!isCampaignServiceType(String(row.service_type || ""))) continue;
      proposalId = row.id as string | number;
      break;
    }
  }

  const conversationId = await ensureConversationLink({
    influencerId: String(app.influencer_id),
    brandEmail,
    brandName,
    proposalId,
  });
  if (!conversationId) {
    return NextResponse.json({ error: "Could not open the conversation" }, { status: 500 });
  }
  return NextResponse.json({ success: true, conversationId });
}