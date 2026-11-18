import { NextResponse } from "next/server";
import { withdrawPendingDeal } from "@/lib/dealCancel";
import { guardProposalAction, isGuardFailure, type ProposalRow } from "@/lib/proposalAccess";
import { partyProposalView, type ProposalParty } from "@/lib/proposalParty";

function preferredParty(value: unknown): ProposalParty | null {
  return value === "influencer" || value === "brand" ? value : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const guarded = await guardProposalAction(request, body.proposalId, "withdraw", preferredParty(body.userType));
    if (isGuardFailure(guarded)) return guarded;

    const result = await withdrawPendingDeal({
      proposal: guarded.proposal,
      reason: body.reason,
    });

    if (!result.ok) {
      const message =
        result.error === "withdraw_reason_too_long"
          ? "Reason is too long."
          : result.error === "proposal_not_withdrawable"
            ? "This proposal cannot be withdrawn."
            : result.error;
      return NextResponse.json({ error: message }, { status: result.status });
    }

    const proposal: ProposalRow = {
      ...guarded.proposal,
      status: "cancelled",
      cancelled_by: "brand",
      cancel_reason:
        body.reason == null || body.reason === ""
          ? null
          : typeof body.reason === "string"
            ? body.reason.trim().slice(0, 1000) || null
            : null,
      cancelled_at: result.cancelledAt,
    };

    return NextResponse.json({
      success: true,
      proposal: partyProposalView(proposal as unknown as Record<string, unknown>),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not withdraw the proposal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}