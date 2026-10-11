import { NextResponse } from "next/server";
import { ensureProposalThread } from "@/lib/proposalChat";
import { loadProposal, partyOf, requireActor } from "@/lib/proposalAccess";

/** Opens the chat card for an offer that was filed before the brand had an account. */
export async function POST(request: Request) {
  try {
    const session = await requireActor(request);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const proposal = await loadProposal(body.proposalId == null ? "" : String(body.proposalId));
    if (!proposal || partyOf(session.actor, proposal, "influencer") !== "influencer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!proposal.brand_email) return NextResponse.json({ error: "Proposal has no brand" }, { status: 400 });

    const content = `Νέα πρόταση: ${proposal.service_type || ""} | Budget: €${proposal.budget || ""}${
      proposal.message ? `\n\n${proposal.message}` : ""
    }`;
    const conversationId = await ensureProposalThread({
      influencerId: String(proposal.influencer_id),
      brandEmail: proposal.brand_email,
      brandName: proposal.brand_name || proposal.brand_email,
      proposalId: proposal.id,
      content,
      replaceLink: false,
      alreadyNotified: true,
    });
    if (!conversationId) return NextResponse.json({ error: "Could not open the conversation" }, { status: 500 });
    return NextResponse.json({ success: true, conversationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not open the conversation";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
