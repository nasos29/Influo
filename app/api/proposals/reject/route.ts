import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { guardProposalAction, isGuardFailure } from "@/lib/proposalAccess";
import { mailProposalDecision } from "@/lib/proposalMail";
import { brandHasAccount, influencerContact } from "@/lib/proposalAccess";
import { refreshInfluencerTrustMetrics } from "@/lib/influencerMetrics";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const guarded = await guardProposalAction(request, body.proposalId, "reject", "influencer");
    if (isGuardFailure(guarded)) return guarded;

    const proposal = guarded.proposal;
    const patch: Record<string, unknown> = { status: "rejected" };
    if ((proposal.counter_proposal_status || "").toLowerCase() === "pending") {
      patch.counter_proposal_status = "rejected";
    }
    const { error } = await supabaseService().from("proposals").update(patch).eq("id", proposal.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const influencer = await influencerContact(proposal.influencer_id);
    await mailProposalDecision({
      accepted: false,
      brandEmail: proposal.brand_email,
      brandName: proposal.brand_name || "Επιχείρηση",
      influencerName: influencer.name,
      brandHasAccount: proposal.brand_email ? await brandHasAccount(proposal.brand_email) : false,
      service: proposal.service_type || "",
      budget: proposal.budget || "",
    });
    try {
      await refreshInfluencerTrustMetrics(supabaseService(), String(proposal.influencer_id));
    } catch (error) {
      console.warn("[proposal reject metrics]", error);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reject the proposal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
