import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { brandHasAccount, guardProposalAction, influencerContact, isGuardFailure } from "@/lib/proposalAccess";
import { mailProposalDecision } from "@/lib/proposalMail";
import { sendPushToBrand } from "@/lib/push";
import { refreshInfluencerTrustMetrics } from "@/lib/influencerMetrics";

async function notifyBrand(proposal: {
  brand_email: string | null;
  brand_name: string | null;
  influencer_id: string;
  service_type: string | null;
  budget: string | null;
}, accepted: boolean) {
  const influencer = await influencerContact(proposal.influencer_id);
  const email = proposal.brand_email;
  await mailProposalDecision({
    accepted,
    brandEmail: email,
    brandName: proposal.brand_name || "Επιχείρηση",
    influencerName: influencer.name,
    brandHasAccount: email ? await brandHasAccount(email) : false,
    service: proposal.service_type || "",
    budget: proposal.budget || "",
  });
  if (accepted && email) {
    try {
      await sendPushToBrand(email, {
        title: "Η πρόταση εγκρίθηκε",
        body: `${influencer.name} αποδέχτηκε την πρότασή σας.`,
        url: "/brand/dashboard",
        tag: "proposal-accepted",
      });
    } catch (error) {
      console.warn("[proposal accept push]", error);
    }
  }
}

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

    await notifyBrand(guarded.proposal, true);
    try {
      await refreshInfluencerTrustMetrics(supabaseService(), String(guarded.proposal.influencer_id));
    } catch (error) {
      console.warn("[proposal accept metrics]", error);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not accept the proposal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
