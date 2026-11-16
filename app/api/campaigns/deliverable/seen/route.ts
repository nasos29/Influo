import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

/**
 * Mark a submitted campaign deliverable as seen by the owning brand (first view only).
 * Admins who are not the campaign brand owner cannot set this.
 * No emails.
 */
export async function POST(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const applicationId = String(body.applicationId || "").trim();
  if (!applicationId || !/^[0-9a-f-]{36}$/i.test(applicationId)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = supabaseService();
  const { data: app } = await admin
    .from("campaign_applications")
    .select("id, deliverable_status, deliverable_seen_at, brand_campaigns ( brand_id )")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const campaignRaw = app.brand_campaigns as unknown;
  const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as {
    brand_id?: string;
  } | null;
  const brandId = typeof campaign?.brand_id === "string" ? campaign.brand_id : "";
  // Owning brand only — not admin impersonation / admin dashboard.
  if (!brandId || brandId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (app.deliverable_status !== "submitted") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "not_submitted",
      seen_at: app.deliverable_seen_at ?? null,
    });
  }

  if (app.deliverable_seen_at) {
    return NextResponse.json({ ok: true, seen_at: app.deliverable_seen_at, already: true });
  }

  const seenAt = new Date().toISOString();
  const { data: updated, error } = await admin
    .from("campaign_applications")
    .update({ deliverable_seen_at: seenAt })
    .eq("id", applicationId)
    .eq("deliverable_status", "submitted")
    .is("deliverable_seen_at", null)
    .select("deliverable_seen_at")
    .maybeSingle();

  if (error) {
    if (/deliverable_seen_at|schema cache|column/i.test(error.message || "")) {
      return NextResponse.json({ error: "column_unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    seen_at: updated?.deliverable_seen_at ?? seenAt,
  });
}
