import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { cancelDeal } from "@/lib/dealCancel";
import { loadProposal } from "@/lib/proposalAccess";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const id = body.proposalId == null ? "" : String(body.proposalId).trim();
    if (!id) return NextResponse.json({ error: "Missing proposalId" }, { status: 400 });

    const proposal = await loadProposal(id);
    if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

    const result = await cancelDeal({
      proposal,
      cancelledBy: "admin",
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

    return NextResponse.json({ success: true, cancelledAt: result.cancelledAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cancel the deal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}