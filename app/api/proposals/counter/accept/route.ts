import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { guardProposalAction, influencerContact, isGuardFailure } from "@/lib/proposalAccess";
import { mailCounterDecision } from "@/lib/proposalMail";
import { deferAfterResponse, pushParty } from "@/lib/proposalNotify";
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

    const budget = String(proposal.counter_proposal_budget);
    deferAfterResponse(async () => {
      const influencer = await influencerContact(proposal.influencer_id);
      const brandName = proposal.brand_name || "Επιχείρηση";
      await Promise.all([
        mailCounterDecision({
          accepted: true,
          influencerEmail: influencer.email,
          influencerName: influencer.name,
          brandName,
          service: proposal.service_type || "",
          budget,
        }),
        pushParty({
          type: "counter_accepted",
          side: "influencer",
          influencerId: proposal.influencer_id,
          brandEmail: proposal.brand_email,
          payload: {
            title: "Η αντιπρόταση εγκρίθηκε",
            body: `${brandName} αποδέχτηκε την αντιπρόταση.`,
            url: "/dashboard",
            tag: "counter-accepted",
          },
        }),
        refreshInfluencerTrustMetrics(supabaseService(), String(proposal.influencer_id)),
      ]);
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not accept the counter proposal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
