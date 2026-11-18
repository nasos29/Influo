import { NextResponse } from "next/server";
import { cancelDeal } from "@/lib/dealCancel";
import { guardProposalAction, isGuardFailure, type ProposalRow } from "@/lib/proposalAccess";
import { partyProposalView, type ProposalParty } from "@/lib/proposalParty";

function preferredParty(value: unknown): ProposalParty | null {
  return value === "influencer" || value === "brand" ? value : null;
}

function partyToCancelledBy(party: ProposalParty): "brand" | "influencer" {
  return party === "brand" ? "brand" : "influencer";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const guarded = await guardProposalAction(request, body.proposalId, "cancel", preferredParty(body.userType));
    if (isGuardFailure(guarded)) return guarded;

    const cancelledBy = partyToCancelledBy(guarded.party);
    const result = await cancelDeal({
      proposal: guarded.proposal,
      cancelledBy,
      reason: body.reason,
    });

    if (!result.ok) {
      const message =
        result.error === "cancel_reason_too_short"
          ? "Please enter a reason (at least 10 characters)."
          : result.error === "cancel_reason_too_long"
            ? "Reason is too long."
            : result.error === "deal_not_cancellable"
              ? "This deal cannot be cancelled."
              : result.error;
      return NextResponse.json({ error: message }, { status: result.status });
    }

    const proposal: ProposalRow = {
      ...guarded.proposal,
      status: "cancelled",
      cancelled_by: cancelledBy,
      cancel_reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "",
      cancelled_at: result.cancelledAt,
    };

    return NextResponse.json({
      success: true,
      proposal: partyProposalView(proposal as unknown as Record<string, unknown>),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cancel the deal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}