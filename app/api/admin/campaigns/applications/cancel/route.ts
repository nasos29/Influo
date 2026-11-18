import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { cancelCampaignDeal } from "@/lib/campaignDealCancel";
import { loadCampaignApplication } from "@/lib/campaignApplicationAccess";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const id = body.applicationId == null ? "" : String(body.applicationId).trim();
    if (!id) return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });

    const application = await loadCampaignApplication(id);
    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    const result = await cancelCampaignDeal({
      application,
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
              : result.error === "migration_pending"
                ? "Cancel is not available until the database migration is applied."
                : result.error;
      return NextResponse.json({ error: message }, { status: result.status });
    }

    return NextResponse.json({ success: true, cancelledAt: result.cancelledAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cancel the deal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}