import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { guardProposalAction, influencerContact, isGuardFailure } from "@/lib/proposalAccess";
import { mailCounterDecision } from "@/lib/proposalMail";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const guarded = await guardProposalAction(request, body.proposalId, "reject_counter", "brand");
    if (isGuardFailure(guarded)) return guarded;

    const proposal = guarded.proposal;
    const { error } = await supabaseService()
      .from("proposals")
      .update({
        counter_proposal_status: "rejected",
        counter_proposal_budget: null,
        counter_proposal_message: null,
      })
      .eq("id", proposal.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const influencer = await influencerContact(proposal.influencer_id);
    await mailCounterDecision({
      accepted: false,
      influencerEmail: influencer.email,
      influencerName: influencer.name,
      brandName: proposal.brand_name || "Επιχείρηση",
      service: proposal.service_type || "",
      budget: proposal.budget || "",
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reject the counter proposal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
