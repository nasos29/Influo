import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { ensureProposalThread } from "@/lib/proposalChat";
import { notifyApplicationStatus } from "@/lib/campaignNotify";

const STATUSES = new Set(["pending", "shortlisted", "rejected", "accepted"]);

export async function POST(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const applicationId = String(body.applicationId || "");
  const status = String(body.status || "");
  if (!applicationId || !STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = supabaseService();
  const { data: app } = await admin
    .from("campaign_applications")
    .select("id, influencer_id, campaign_id, message, status, brand_campaigns ( id, title, budget, brand_id, brands ( brand_name, contact_email ) )")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const campaignRaw = app.brand_campaigns as unknown;
  const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as {
    id: string;
    title: string;
    budget: number;
    brand_id: string;
    brands?: { brand_name?: string; contact_email?: string } | { brand_name?: string; contact_email?: string }[] | null;
  } | null;
  if (!campaign || campaign.brand_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: updateError } = await admin
    .from("campaign_applications")
    .update({ status })
    .eq("id", applicationId);
  if (updateError) {
    const migration = /check constraint|status/i.test(updateError.message);
    return NextResponse.json(
      {
        error: migration
          ? "Run docs/CAMPAIGN_WORKFLOW_2026.sql in Supabase so applications can be accepted."
          : updateError.message,
      },
      { status: 400 }
    );
  }

  let conversationId: string | null = null;
  let proposalId: string | number | null = null;
  if (status === "shortlisted" || status === "accepted" || status === "rejected") {
    await notifyApplicationStatus({
      influencerId: String(app.influencer_id),
      campaignTitle: campaign.title,
      status,
      campaignId: campaign.id,
    }).catch((err) => console.error("[campaign status notify]", err));
  }

  if (status === "accepted") {
    const brandRow = Array.isArray(campaign.brands) ? campaign.brands[0] : campaign.brands;
    const brandName = brandRow?.brand_name || "Brand";
    const brandEmail = (brandRow?.contact_email || user.email || "").toLowerCase();
    const budget = Math.max(1, Number(campaign.budget) || 0);
    const { data: proposal, error: proposalError } = await admin
      .from("proposals")
      .insert([
        {
          influencer_id: app.influencer_id,
          brand_name: brandName,
          brand_email: brandEmail,
          brand_id: user.id,
          service_type: `Καμπάνια: ${campaign.title}`.slice(0, 120),
          budget,
          message: `Αποδοχή αίτησης για την καμπάνια «${campaign.title}».`,
          status: "accepted",
          counter_proposal_status: "none",
        },
      ])
      .select("id")
      .single();
    if (!proposalError && proposal) {
      proposalId = proposal.id;
      try {
        conversationId = await ensureProposalThread({
          influencerId: String(app.influencer_id),
          brandEmail,
          brandName,
          proposalId: proposal.id,
          content: `Η αίτησή σας για «${campaign.title}» έγινε αποδεκτή. Μπορούμε να συνεχίσουμε εδώ.`,
          replaceLink: true,
          alreadyNotified: true,
        });
      } catch (err) {
        console.error("[campaign accept thread]", err);
      }
    } else if (proposalError) {
      console.error("[campaign accept proposal]", proposalError.message);
    }
  }

  return NextResponse.json({ ok: true, status, conversationId, proposalId });
}
