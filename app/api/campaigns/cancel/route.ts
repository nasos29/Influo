import { NextResponse } from "next/server";
import { cancelCampaignDeal } from "@/lib/campaignDealCancel";
import { guardCampaignApplicationCancel } from "@/lib/campaignApplicationAccess";

function partyToCancelledBy(party: "brand" | "influencer"): "brand" | "influencer" {
  return party;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const preferred =
      body.userType === "influencer" || body.userType === "brand" ? body.userType : null;
    const guarded = await guardCampaignApplicationCancel(request, body.applicationId, preferred);
    if (!("ok" in guarded) || !guarded.ok) return guarded;

    const cancelledBy = partyToCancelledBy(guarded.party);
    const result = await cancelCampaignDeal({
      application: guarded.application,
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
              : result.error === "migration_pending"
                ? "Cancel is not available until the database migration is applied."
                : result.error;
      return NextResponse.json({ error: message }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      application: {
        ...guarded.application,
        status: "cancelled",
        cancelled_by: cancelledBy,
        cancel_reason: typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "",
        cancelled_at: result.cancelledAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cancel the deal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}