import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { creatorContact } from "@/lib/campaignNotify";
import { deliverableReviewToCreator, deliverableSubmittedToBrand } from "@/lib/campaignMail";
import { send } from "@/lib/proposalMail";
import { deferAfterResponse } from "@/lib/proposalNotify";
import { sendPushToBrand, sendPushToInfluencer } from "@/lib/push";

type Action = "submit" | "approve" | "request_changes";

/**
 * RLS-safe deliverable submit/review via server API so we can notify the other party (Q6).
 * - Creator submit → brand email + push
 * - Brand approve / request_changes → creator email + push
 */
export async function POST(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const applicationId = String(body.applicationId || "").trim();
  const action = String(body.action || "").trim() as Action;
  if (!applicationId || !["submit", "approve", "request_changes"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = supabaseService();
  const { data: app } = await admin
    .from("campaign_applications")
    .select(
      "id, influencer_id, status, deliverable_status, brand_campaigns ( id, title, brand_id, brands ( brand_name, contact_email ) )"
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const campaignRaw = app.brand_campaigns as unknown;
  const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as {
    id: string;
    title: string;
    brand_id: string;
    brands?: { brand_name?: string; contact_email?: string } | { brand_name?: string; contact_email?: string }[] | null;
  } | null;
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const brandRow = Array.isArray(campaign.brands) ? campaign.brands[0] : campaign.brands;
  const brandName = brandRow?.brand_name || "Brand";
  const brandEmail = (brandRow?.contact_email || "").trim().toLowerCase();
  const campaignTitle = campaign.title || "Καμπάνια";

  if (action === "submit") {
    const { data: influencer } = await admin
      .from("influencers")
      .select("id, auth_user_id, contact_email, display_name")
      .eq("id", app.influencer_id)
      .maybeSingle();
    if (!influencer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const userEmail = (user.email || "").trim().toLowerCase();
    const owns =
      influencer.auth_user_id === user.id ||
      (!influencer.auth_user_id &&
        !!userEmail &&
        (influencer.contact_email || "").trim().toLowerCase() === userEmail);
    if (!owns) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (app.status !== "accepted") {
      return NextResponse.json({ error: "not_accepted" }, { status: 400 });
    }

    const url = String(body.url || "").trim();
    const note = String(body.note || "").trim();
    if (!url) return NextResponse.json({ error: "missing_url" }, { status: 400 });

    const { error } = await admin
      .from("campaign_applications")
      .update({
        deliverable_url: url,
        deliverable_note: note || null,
        deliverable_status: "submitted",
        delivered_at: new Date().toISOString(),
      })
      .eq("id", applicationId)
      .eq("influencer_id", influencer.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const influencerName = influencer.display_name || "Influencer";
    deferAfterResponse(async () => {
      try {
        if (brandEmail) {
          const mail = deliverableSubmittedToBrand({
            brandEmail,
            brandName,
            campaignTitle,
            influencerName,
            deliverableUrl: url,
          });
          await send("campaign_deliverable_submitted_brand", brandEmail, mail.subject, mail.html);
          await sendPushToBrand(brandEmail, {
            title: "Νέα παράδοση",
            body: `${influencerName}: ${campaignTitle}`.slice(0, 120),
            url: "/brand/dashboard?tab=campaigns",
            tag: `deliverable-submitted-${applicationId}`,
          }).catch((err) => console.error("[deliverable] brand push", err));
        }
      } catch (err) {
        console.error("[deliverable] submit notify", err);
      }
    });

    return NextResponse.json({ ok: true, status: "submitted" });
  }

  // Brand review paths
  if (campaign.brand_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (app.deliverable_status !== "submitted" && app.deliverable_status !== "changes_requested") {
    // Allow approve/changes from submitted; also tolerate re-review of changes_requested after re-submit.
  }
  const nextStatus = action === "approve" ? "approved" : "changes_requested";
  const reviewNote = String(body.note || "").trim();

  const { error } = await admin
    .from("campaign_applications")
    .update({
      deliverable_status: nextStatus,
      deliverable_review_note: reviewNote || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", applicationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  deferAfterResponse(async () => {
    try {
      const person = await creatorContact(String(app.influencer_id));
      if (!person) return;
      const mail = deliverableReviewToCreator({
        influencerName: person.name,
        brandName,
        campaignTitle,
        status: nextStatus,
        reviewNote: reviewNote || null,
      });
      if (person.email) {
        await send(
          nextStatus === "approved" ? "campaign_deliverable_approved_creator" : "campaign_deliverable_changes_creator",
          person.email,
          mail.subject,
          mail.html
        );
      }
      await sendPushToInfluencer(person.id, {
        title: nextStatus === "approved" ? "Η παράδοσή σου εγκρίθηκε" : "Ζητήθηκαν αλλαγές",
        body: `${brandName}: ${campaignTitle}`.slice(0, 120),
        url: "/dashboard?tab=campaigns",
        tag: `deliverable-${nextStatus}-${applicationId}`,
      }).catch((err) => console.error("[deliverable] creator push", err));
    } catch (err) {
      console.error("[deliverable] review notify", err);
    }
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
