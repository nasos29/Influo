import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { creatorContact } from "@/lib/campaignNotify";
import {
  deliverableApprovedToBrand,
  deliverableReviewToCreator,
  deliverableSubmittedToBrand,
} from "@/lib/campaignMail";
import { send } from "@/lib/proposalMail";
import { deferAfterResponse } from "@/lib/proposalNotify";
import { sendPushToBrand, sendPushToInfluencer } from "@/lib/push";
import {
  parseSelfReportedCount,
  parseSocialPostUrl,
  socialPostUrlErrorMessage,
} from "@/lib/socialPostUrl";
import { showcaseOptOutUrl } from "@/lib/showcaseOptOut";

type Action = "submit" | "approve" | "request_changes";

/**
 * RLS-safe deliverable submit/review via server API so we can notify the other party (Q6).
 * - Creator submit → brand email + push
 * - Brand approve / request_changes → creator email + push
 * - Brand approve → brand confirmation (+ showcase opt-out line when brand consent is true)
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
  const appSelectWithSeen =
    "id, influencer_id, status, deliverable_status, deliverable_seen_at, brand_showcase_consent, influencer_showcase_consent, brand_campaigns ( id, title, brand_id, brands ( brand_name, contact_email ) )";
  const appSelectBasic =
    "id, influencer_id, status, deliverable_status, brand_showcase_consent, influencer_showcase_consent, brand_campaigns ( id, title, brand_id, brands ( brand_name, contact_email ) )";
  const appSelectLegacy =
    "id, influencer_id, status, deliverable_status, brand_campaigns ( id, title, brand_id, brands ( brand_name, contact_email ) )";
  let appRes = await admin
    .from("campaign_applications")
    .select(appSelectWithSeen)
    .eq("id", applicationId)
    .maybeSingle();
  if (appRes.error && /deliverable_seen_at|schema cache|column/i.test(appRes.error.message || "")) {
    appRes = await admin
      .from("campaign_applications")
      .select(appSelectBasic)
      .eq("id", applicationId)
      .maybeSingle();
  }
  if (
    appRes.error &&
    /showcase_consent|schema cache|column|42703|PGRST204/i.test(appRes.error.message || "")
  ) {
    appRes = await admin
      .from("campaign_applications")
      .select(appSelectLegacy)
      .eq("id", applicationId)
      .maybeSingle();
  }
  const app = appRes.data;
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
  const existingInfluencerConsent = !!(app as { influencer_showcase_consent?: boolean | null })
    .influencer_showcase_consent;

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

    const parsedUrl = parseSocialPostUrl(body.url);
    if (!parsedUrl.ok) {
      return NextResponse.json(
        { error: parsedUrl.error === "empty" ? "missing_url" : socialPostUrlErrorMessage(parsedUrl.error) },
        { status: 400 }
      );
    }
    const url = parsedUrl.url;
    const note = String(body.note || "").trim();
    const selfReportedViews = "selfReportedViews" in body
      ? parseSelfReportedCount(body.selfReportedViews)
      : undefined;
    const selfReportedReach = "selfReportedReach" in body
      ? parseSelfReportedCount(body.selfReportedReach)
      : undefined;
    const showcaseConsent =
      typeof body.showcaseConsent === "boolean" ? body.showcaseConsent : undefined;

    const updatePayload: Record<string, unknown> = {
      deliverable_url: url,
      deliverable_note: note || null,
      deliverable_status: "submitted",
      delivered_at: new Date().toISOString(),
      // New URL → brand must view again (seen receipt resets).
      deliverable_seen_at: null,
    };
    if (selfReportedViews !== undefined) updatePayload.self_reported_views = selfReportedViews;
    if (selfReportedReach !== undefined) updatePayload.self_reported_reach = selfReportedReach;
    if (showcaseConsent !== undefined) updatePayload.influencer_showcase_consent = showcaseConsent;

    let { error } = await admin
      .from("campaign_applications")
      .update(updatePayload)
      .eq("id", applicationId)
      .eq("influencer_id", influencer.id);
    if (error && /deliverable_seen_at|schema cache|column/i.test(error.message || "")) {
      const { deliverable_seen_at: _drop, ...withoutSeen } = updatePayload;
      ({ error } = await admin
        .from("campaign_applications")
        .update(withoutSeen)
        .eq("id", applicationId)
        .eq("influencer_id", influencer.id));
    }
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
  const brandShowcaseConsent =
    action === "approve" && typeof body.showcaseConsent === "boolean"
      ? body.showcaseConsent
      : undefined;

  const reviewUpdate: Record<string, unknown> = {
    deliverable_status: nextStatus,
    deliverable_review_note: reviewNote || null,
    reviewed_at: new Date().toISOString(),
  };
  // Approving / requesting changes implies the brand has seen the deliverable (first time only).
  const existingSeen =
    typeof (app as { deliverable_seen_at?: string | null }).deliverable_seen_at === "string"
      ? (app as { deliverable_seen_at?: string | null }).deliverable_seen_at
      : null;
  if (!existingSeen) {
    reviewUpdate.deliverable_seen_at = new Date().toISOString();
  }
  if (brandShowcaseConsent !== undefined) {
    reviewUpdate.brand_showcase_consent = brandShowcaseConsent;
  }

  let { error } = await admin
    .from("campaign_applications")
    .update(reviewUpdate)
    .eq("id", applicationId);
  if (error && /deliverable_seen_at|schema cache|column/i.test(error.message || "")) {
    const { deliverable_seen_at: _drop, ...withoutSeen } = reviewUpdate;
    ({ error } = await admin.from("campaign_applications").update(withoutSeen).eq("id", applicationId));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const existingBrandConsent = !!(app as { brand_showcase_consent?: boolean | null }).brand_showcase_consent;
  const creatorConsentTrue = existingInfluencerConsent;
  const brandConsentTrue =
    brandShowcaseConsent === true || (brandShowcaseConsent === undefined && existingBrandConsent);

  deferAfterResponse(async () => {
    try {
      const person = await creatorContact(String(app.influencer_id));
      if (!person) return;
      const creatorOptOut =
        nextStatus === "approved" && creatorConsentTrue
          ? showcaseOptOutUrl("campaign", applicationId, "influencer", "el")
          : null;
      const mail = deliverableReviewToCreator({
        influencerName: person.name,
        brandName,
        campaignTitle,
        status: nextStatus,
        reviewNote: reviewNote || null,
        showcaseOptOutUrl: creatorOptOut,
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

      if (nextStatus === "approved" && brandEmail) {
        const brandOptOut = brandConsentTrue
          ? showcaseOptOutUrl("campaign", applicationId, "brand", "el")
          : null;
        const brandMail = deliverableApprovedToBrand({
          brandEmail,
          brandName,
          campaignTitle,
          influencerName: person.name,
          showcaseOptOutUrl: brandOptOut,
        });
        await send(
          "campaign_deliverable_approved_brand",
          brandEmail,
          brandMail.subject,
          brandMail.html
        ).catch((err) => console.error("[deliverable] brand approve mail", err));
      }
    } catch (err) {
      console.error("[deliverable] review notify", err);
    }
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
