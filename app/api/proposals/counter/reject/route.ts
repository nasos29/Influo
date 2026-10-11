import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { guardProposalAction, influencerContact, isGuardFailure } from "@/lib/proposalAccess";
import { mailCounterDecision } from "@/lib/proposalMail";
import { deferAfterResponse, pushParty } from "@/lib/proposalNotify";

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

    deferAfterResponse(async () => {
      const influencer = await influencerContact(proposal.influencer_id);
      const brandName = proposal.brand_name || "Επιχείρηση";
      await Promise.all([
        mailCounterDecision({
          accepted: false,
          influencerEmail: influencer.email,
          influencerName: influencer.name,
          brandName,
          service: proposal.service_type || "",
          budget: proposal.budget || "",
        }),
        pushParty({
          type: "counter_rejected",
          side: "influencer",
          influencerId: proposal.influencer_id,
          brandEmail: proposal.brand_email,
          payload: {
            title: "Η αντιπρόταση απορρίφθηκε",
            body: `${brandName} απέρριψε την αντιπρόταση.`,
            url: "/dashboard",
            tag: "counter-rejected",
          },
        }),
      ]);
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reject the counter proposal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
