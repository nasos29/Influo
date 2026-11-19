import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { ACTIVE_PROPOSAL_STATUSES } from "@/lib/campaignProposalIdempotency";
import { ensureProposalThread } from "@/lib/proposalChat";

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
  const serviceType = `Καμπάνια: ${campaignTitle}`.slice(0, 120);
  const brandId = campaign?.brand_id || "";
  let proposalId: string | number | null = null;
  if (brandId) {
    const { data: proposal } = await admin
      .from("proposals")
      .select("id")
      .eq("brand_id", brandId)
      .eq("influencer_id", app.influencer_id)
      .eq("service_type", serviceType)
      .in("status", [...ACTIVE_PROPOSAL_STATUSES])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (proposal?.id != null) proposalId = proposal.id;
  }

  if (proposalId == null) {
    return NextResponse.json({ error: "no_conversation" }, { status: 404 });
  }

  const conversationId = await ensureProposalThread({
    influencerId: String(app.influencer_id),
    brandEmail,
    brandName,
    proposalId,
    content: `Συνομιλία για την καμπάνια «${campaignTitle}».`,
    replaceLink: false,
    alreadyNotified: true,
  });
  if (!conversationId) {
    return NextResponse.json({ error: "Could not open the conversation" }, { status: 500 });
  }
  return NextResponse.json({ success: true, conversationId });
}