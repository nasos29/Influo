import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { brandHasAccount, guardProposalAction, influencerContact, isGuardFailure } from "@/lib/proposalAccess";
import { mailCounter } from "@/lib/proposalMail";
import { cleanBudget, clipText } from "@/lib/proposalParty";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const guarded = await guardProposalAction(request, body.proposalId, "counter", "influencer");
    if (isGuardFailure(guarded)) return guarded;

    const counterBudget = cleanBudget(body.counterBudget);
    if (!counterBudget) return NextResponse.json({ error: "Συμπληρώστε ποσό αντιπρότασης." }, { status: 400 });
    const counterMessage = clipText(body.counterMessage, 2000);

    const { error } = await supabaseService()
      .from("proposals")
      .update({
        counter_proposal_budget: counterBudget,
        counter_proposal_message: counterMessage || null,
        counter_proposal_status: "pending",
        counter_proposal_created_at: new Date().toISOString(),
      })
      .eq("id", guarded.proposal.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const proposal = guarded.proposal;
    const influencer = await influencerContact(proposal.influencer_id);
    await mailCounter({
      brandEmail: proposal.brand_email,
      brandName: proposal.brand_name || "Επιχείρηση",
      influencerName: influencer.name,
      service: proposal.service_type || "",
      budget: proposal.budget || "",
      counterBudget,
      counterMessage,
      brandHasAccount: proposal.brand_email ? await brandHasAccount(proposal.brand_email) : false,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send the counter proposal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
