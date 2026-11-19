import { NextRequest, NextResponse } from "next/server";
import { isAdminUser, supabaseService, userFromBearer } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const APP_SELECTS = [
  "id, campaign_id, influencer_id, message, status, created_at, proposed_price, work_links, deliverable_url, deliverable_note, deliverable_status, deliverable_review_note, deliverable_seen_at, brand_showcase_consent, initiated_by",
  "id, campaign_id, influencer_id, message, status, created_at, proposed_price, work_links, deliverable_url, deliverable_note, deliverable_status, deliverable_review_note, deliverable_seen_at, initiated_by",
  "id, campaign_id, influencer_id, message, status, created_at, proposed_price, work_links, deliverable_url, deliverable_note, deliverable_status, deliverable_review_note",
  "id, campaign_id, influencer_id, message, status, created_at, deliverable_url, deliverable_note, deliverable_status, deliverable_review_note",
];

/**
 * Applications for one campaign — brand owner or admin.
 * Uses service role so browser column-grant / embed quirks cannot hide rows the brand owns.
 */
export async function GET(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaignId = new URL(request.url).searchParams.get("campaignId")?.trim();
  if (!campaignId || !/^[0-9a-f-]{36}$/i.test(campaignId)) {
    return NextResponse.json({ error: "campaignId" }, { status: 400 });
  }

  const admin = supabaseService();
  const { data: campaign } = await admin
    .from("brand_campaigns")
    .select("id, brand_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (String(campaign.brand_id) !== user.id && !(await isAdminUser(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let apps: Record<string, unknown>[] | null = null;
  let lastError: { message?: string } | null = null;
  for (const select of APP_SELECTS) {
    const result = await admin
      .from("campaign_applications")
      .select(select)
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });
    if (!result.error) {
      apps = (result.data || []) as unknown as Record<string, unknown>[];
      lastError = null;
      break;
    }
    lastError = result.error;
    if (!/column|schema cache|could not find the/i.test(result.error.message || "")) break;
  }

  if (lastError) {
    console.error("[campaigns/applications GET]", lastError);
    return NextResponse.json({ error: lastError.message || "load_failed" }, { status: 500 });
  }

  return NextResponse.json({ applications: apps || [] });
}
