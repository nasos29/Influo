import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { ensureProposalThread } from "@/lib/proposalChat";
import { notifyApplicationStatus } from "@/lib/campaignNotify";
import { findContactInfo, filterWorkLinks } from "@/lib/contactFilter";

const STATUSES = new Set(["pending", "shortlisted", "rejected", "accepted"]);

async function createApplication(request: NextRequest, body: Record<string, unknown>) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaignId = String(body.campaignId || "").trim();
  const influencerId = String(body.influencerId || "").trim() || user.id;
  const message = String(body.message ?? "");
  const workLinksRaw = String(body.workLinks ?? "");
  const proposedPriceRaw = body.proposedPrice != null ? String(body.proposedPrice) : "";

  if (!campaignId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (influencerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const contactHit = findContactInfo(message);
  if (contactHit) {
    return NextResponse.json(
      { error: "contact_info_not_allowed", field: "message", kind: contactHit },
      { status: 400 }
    );
  }

  const filtered = filterWorkLinks(workLinksRaw);
  if (filtered.rejected.length > 0) {
    return NextResponse.json(
      { error: "work_link_not_allowed", rejected: filtered.rejected },
      { status: 400 }
    );
  }

  const admin = supabaseService();
  const { data: influencer } = await admin
    .from("influencers")
    .select("id, approved, availability_status")
    .eq("id", influencerId)
    .maybeSingle();
  if (!influencer) {
    return NextResponse.json({ error: "Influencer not found" }, { status: 404 });
  }
  if (!influencer.approved) {
    return NextResponse.json({ error: "Not approved" }, { status: 403 });
  }

  const { data: campaign } = await admin
    .from("brand_campaigns")
    .select("id, status")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign || campaign.status !== "open") {
    return NextResponse.json({ error: "Campaign not available" }, { status: 400 });
  }

  const price = proposedPriceRaw.trim()
    ? Number(proposedPriceRaw.replace(",", "."))
    : null;
  const base = {
    campaign_id: campaignId,
    influencer_id: influencerId,
    message: message.trim() || null,
    status: "pending" as const,
  };
  const full: Record<string, unknown> = { ...base };
  if (price != null && Number.isFinite(price) && price >= 0) full.proposed_price = price;
  if (filtered.ok.length > 0) full.work_links = filtered.ok.join("\n");

  let result = await admin.from("campaign_applications").insert(full).select("id").single();
  if (result.error && /proposed_price|work_links|schema cache|column/i.test(result.error.message)) {
    result = await admin.from("campaign_applications").insert(base).select("id").single();
    if (!result.error) {
      return NextResponse.json({ ok: true, id: result.data?.id, migration: true });
    }
  }
  if (result.error) {
    if (result.error.code === "23505") {
      return NextResponse.json({ error: "duplicate", duplicate: true }, { status: 409 });
    }
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: result.data?.id });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Create application (influencer apply)
  if (body.campaignId && !body.applicationId) {
    return createApplication(request, body);
  }

  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    .update({ status, reviewed_at: new Date().toISOString() })
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
