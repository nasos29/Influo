import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { guardProposalAction, influencerContact, isGuardFailure } from "@/lib/proposalAccess";
import { mailCounterDecision } from "@/lib/proposalMail";
import { refreshInfluencerTrustMetrics } from "@/lib/influencerMetrics";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const guarded = await guardProposalAction(request, body.proposalId, "accept_counter", "brand");
    if (isGuardFailure(guarded)) return guarded;

    const proposal = guarded.proposal;
    if (!proposal.counter_proposal_budget) {
      return NextResponse.json({ error: "No counter proposal found" }, { status: 400 });
    }

    const { error } = await supabaseService()
      .from("proposals")
      .update({
        budget: proposal.counter_proposal_budget,
        counter_proposal_status: "accepted",
        status: "accepted",
      })
      .eq("id", proposal.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const influencer = await influencerContact(proposal.influencer_id);
    await mailCounterDecision({
      accepted: true,
      influencerEmail: influencer.email,
      influencerName: influencer.name,
      brandName: proposal.brand_name || "Επιχείρηση",
      service: proposal.service_type || "",
      budget: String(proposal.counter_proposal_budget),
    });
    try {
      await refreshInfluencerTrustMetrics(supabaseService(), String(proposal.influencer_id));
    } catch (error) {
      console.warn("[counter accept metrics]", error);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not accept the counter proposal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
