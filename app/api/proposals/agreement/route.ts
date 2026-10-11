import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import {
  brandHasAccount,
  guardProposalAction,
  influencerContact,
  isGuardFailure,
  loadProposal,
  partyOf,
  requireActor,
} from "@/lib/proposalAccess";
import { mailAgreement, mailCollaborationComplete } from "@/lib/proposalMail";
import { partyProposalView, type ProposalParty } from "@/lib/proposalParty";

function preferredParty(value: unknown): ProposalParty | null {
  return value === "influencer" || value === "brand" ? value : null;
}

export async function GET(request: Request) {
  try {
    const session = await requireActor(request);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const id = new URL(request.url).searchParams.get("proposalId") || "";
    if (!id) return NextResponse.json({ error: "proposalId required" }, { status: 400 });
    const proposal = await loadProposal(id);
    if (!proposal || !partyOf(session.actor, proposal)) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }
    return NextResponse.json({
      proposal: partyProposalView({
        id: proposal.id,
        influencer_id: proposal.influencer_id,
        brand_name: proposal.brand_name,
        brand_email: proposal.brand_email,
        service_type: proposal.service_type,
        budget: proposal.budget,
        status: proposal.status,
        counter_proposal_budget: proposal.counter_proposal_budget,
        counter_proposal_status: proposal.counter_proposal_status,
        influencer_agreement_accepted: proposal.influencer_agreement_accepted,
        brand_agreement_accepted: proposal.brand_agreement_accepted,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the agreement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.accepted !== true) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const guarded = await guardProposalAction(request, body.proposalId, "agree", preferredParty(body.userType));
    if (isGuardFailure(guarded)) return guarded;

    const proposal = guarded.proposal;
    const party = guarded.party;
    const updateData: Record<string, unknown> = {};
    if (party === "influencer") updateData.influencer_agreement_accepted = true;
    if (party === "brand") updateData.brand_agreement_accepted = true;

    const influencerAccepted = party === "influencer" ? true : !!proposal.influencer_agreement_accepted;
    const brandAccepted = party === "brand" ? true : !!proposal.brand_agreement_accepted;
    const influencer = await influencerContact(proposal.influencer_id);
    const amount = String(proposal.counter_proposal_status === "accepted" && proposal.counter_proposal_budget
      ? proposal.counter_proposal_budget
      : proposal.budget || "");

    if (influencerAccepted && brandAccepted && !proposal.brand_added_to_past_brands) {
      updateData.agreement_accepted_at = new Date().toISOString();
      const current = await supabaseService()
        .from("influencers")
        .select("past_brands")
        .eq("id", proposal.influencer_id)
        .maybeSingle();
      const past = Array.isArray(current.data?.past_brands) ? current.data.past_brands : [];
      const brandName = proposal.brand_name || "";
      if (brandName && !past.includes(brandName)) {
        await supabaseService()
          .from("influencers")
          .update({ past_brands: [...past, brandName] })
          .eq("id", proposal.influencer_id);
        updateData.brand_added_to_past_brands = true;
      }
      await mailCollaborationComplete({
        influencerEmail: influencer.email,
        influencerName: influencer.name,
        brandName: brandName || "Επιχείρηση",
      });
    } else if (party === "influencer") {
      await mailAgreement({
        to: proposal.brand_email,
        recipientName: proposal.brand_name || "Επιχείρηση",
        otherName: influencer.name,
        service: proposal.service_type || "",
        budget: amount,
        toBrand: true,
        brandHasAccount: proposal.brand_email ? await brandHasAccount(proposal.brand_email) : false,
      });
    } else {
      await mailAgreement({
        to: influencer.email,
        recipientName: influencer.name,
        otherName: proposal.brand_name || "Επιχείρηση",
        service: proposal.service_type || "",
        budget: amount,
        toBrand: false,
        brandHasAccount: false,
      });
    }

    const { error } = await supabaseService().from("proposals").update(updateData).eq("id", proposal.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the agreement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
