import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { requireActor } from "@/lib/proposalAccess";
import { clipText } from "@/lib/proposalParty";
import { findContactInfo } from "@/lib/contactFilter";

/**
 * Records a brand→creator campaign invite on campaign_applications.
 * The invitation itself is the existing proposal (message + notification),
 * sent by the client through POST /api/proposals before this call.
 * This route does not send email.
 *
 * If initiated_by does not exist yet (docs/CAMPAIGN_BRAND_INVITE.sql is not applied),
 * the insert is skipped and the response is still ok.
 */
const INVITE_ERRORS = {
  brand: { el: "Συνδεθείτε ως επιχείρηση.", en: "Sign in as a brand." },
  self: { el: "Δεν μπορείτε να προσκαλέσετε τον εαυτό σας.", en: "You cannot invite yourself." },
} as const;

export async function POST(request: Request) {
  const raw = await request.json().catch(() => ({}));
  const body = raw && typeof raw === "object" ? raw : {};
  const lang = body.lang === "en" ? "en" : "el";
  const say = (copy: { el: string; en: string }, status: number) =>
    NextResponse.json({ error: copy[lang], message: copy }, { status });

  const session = await requireActor(request);
  if (!session?.actor.brandId) {
    return say(INVITE_ERRORS.brand, 401);
  }

  const campaignId = clipText(body.campaignId, 80);
  const influencerId = clipText(body.influencerId, 80);
  const message = clipText(body.message, 2000);
  if (!campaignId || !influencerId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (session.actor.influencerId && session.actor.influencerId === influencerId) {
    return say(INVITE_ERRORS.self, 403);
  }
  const contactHit = findContactInfo(message);
  if (contactHit) {
    return NextResponse.json({ error: "contact_info_not_allowed", kind: contactHit }, { status: 400 });
  }

  const admin = supabaseService();
  const { data: campaign } = await admin
    .from("brand_campaigns")
    .select("id, brand_id, status")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign || campaign.brand_id !== session.actor.brandId) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  if (campaign.status !== "open" && campaign.status !== "draft") {
    return NextResponse.json({ error: "Campaign not available" }, { status: 400 });
  }

  const row = {
    campaign_id: campaignId,
    influencer_id: influencerId,
    message: message || null,
    status: "pending",
    initiated_by: "brand",
  };
  const inserted = await admin.from("campaign_applications").insert(row).select("id").single();
  if (!inserted.error) {
    return NextResponse.json({ ok: true, id: inserted.data?.id, recorded: true });
  }
  if (inserted.error.code === "23505") {
    return NextResponse.json({ ok: true, recorded: false, duplicate: true });
  }
  if (/initiated_by|schema cache|column/i.test(inserted.error.message)) {
    return NextResponse.json({ ok: true, recorded: false, migration: true });
  }
  return NextResponse.json({ error: inserted.error.message }, { status: 400 });
}
