import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { brandHasAccount, guardProposalAction, influencerContact, isGuardFailure } from "@/lib/proposalAccess";
import { mailProposalDecision } from "@/lib/proposalMail";
import { deferAfterResponse, pushParty } from "@/lib/proposalNotify";
import { refreshInfluencerTrustMetrics } from "@/lib/influencerMetrics";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const guarded = await guardProposalAction(request, body.proposalId, "accept", "influencer");
    if (isGuardFailure(guarded)) return guarded;

    const { error } = await supabaseService()
      .from("proposals")
      .update({ status: "accepted" })
      .eq("id", guarded.proposal.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const proposal = guarded.proposal;
    deferAfterResponse(async () => {
      const influencer = await influencerContact(proposal.influencer_id);
      const email = proposal.brand_email;
      await Promise.all([
        mailProposalDecision({
          accepted: true,
          brandEmail: email,
          brandName: proposal.brand_name || "Επιχείρηση",
          influencerName: influencer.name,
          brandHasAccount: email ? await brandHasAccount(email) : false,
          service: proposal.service_type || "",
          budget: proposal.budget || "",
        }),
        pushParty({
          type: "proposal_accepted",
          side: "brand",
          influencerId: proposal.influencer_id,
          brandEmail: email,
          payload: {
            title: "Η πρόταση εγκρίθηκε",
            body: `${influencer.name} αποδέχτηκε την πρότασή σας.`,
            url: "/brand/dashboard",
            tag: "proposal-accepted",
          },
        }),
        refreshInfluencerTrustMetrics(supabaseService(), String(proposal.influencer_id)),
      ]);
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not accept the proposal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
