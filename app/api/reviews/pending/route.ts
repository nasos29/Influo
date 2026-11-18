import { NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { BRAND_REVIEW_MARKER, CREATOR_TARGET_REVIEW_FILTER } from "@/lib/brandReview";
import { loadChatActor } from "@/lib/chatActor";
import { isRealDeliveryComplete } from "@/lib/deliveryCompletion";
import { publicProfilePath } from "@/lib/profileSlug";

export const runtime = "nodejs";

/**
 * GET — completed collaborations that still need a review (and optionally a post link)
 * for the signed-in party. Used by the dashboard combined prompt panel.
 */
export async function GET(req: Request) {
  try {
    const user = await userFromBearer(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = supabaseService();
    const actor = await loadChatActor(user);
    const partyParam = new URL(req.url).searchParams.get("party");
    const party =
      partyParam === "brand" || partyParam === "influencer"
        ? partyParam
        : actor.brandId
          ? "brand"
          : actor.influencerId
            ? "influencer"
            : null;
    if (!party) return NextResponse.json({ error: "No profile" }, { status: 403 });
    if (party === "brand" && !actor.brandId && !actor.brandEmail) {
      return NextResponse.json({ error: "Brand account required" }, { status: 403 });
    }
    if (party === "influencer" && !actor.influencerId) {
      return NextResponse.json({ error: "Creator account required" }, { status: 403 });
    }

    let query = admin
      .from("proposals")
      .select(
        "id, brand_name, brand_email, influencer_id, status, influencer_agreement_accepted, brand_agreement_accepted, published_post_url, brand_review_prompts_declined_at, influencer_review_prompts_declined_at, delivery_confirmed_at, auto_completed_at"
      )
      .eq("status", "completed")
      .eq("influencer_agreement_accepted", true)
      .eq("brand_agreement_accepted", true)
      .or("delivery_confirmed_at.not.is.null,auto_completed_at.not.is.null")
      .order("delivery_confirmed_at", { ascending: false, nullsFirst: false })
      .limit(40);

    if (party === "influencer") {
      query = query.eq("influencer_id", actor.influencerId!).is("influencer_review_prompts_declined_at", null);
    } else {
      query = query.is("brand_review_prompts_declined_at", null);
      if (actor.brandEmail) {
        query = query.ilike("brand_email", actor.brandEmail);
      } else if (actor.brandId) {
        query = query.eq("brand_id", actor.brandId);
      }
    }

    let { data: rows, error } = await query;
    if (error) {
      // Soft-fail when decline or delivery columns are not migrated yet.
      if (/review_prompts_declined|delivery_confirmed|auto_completed|PGRST204|42703/i.test(error.message || "")) {
        return NextResponse.json({ pending: [], migrationPending: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const pending: Array<{
      proposalId: string;
      brandName: string;
      creatorName: string | null;
      profileUrl: string | null;
      needsReview: boolean;
      needsPostLink: boolean;
      publishedPostUrl: string | null;
    }> = [];

    for (const row of rows || []) {
      if (!isRealDeliveryComplete(row)) continue;
      const brandEmail = String(row.brand_email || "").trim();
      const influencerId = String(row.influencer_id || "");
      if (!brandEmail || !influencerId) continue;

      let alreadyReviewed = false;
      if (party === "brand") {
        const { data: existing } = await admin
          .from("influencer_reviews")
          .select("id")
          .eq("influencer_id", influencerId)
          .ilike("brand_email", brandEmail)
          .or(CREATOR_TARGET_REVIEW_FILTER)
          .limit(1)
          .maybeSingle();
        alreadyReviewed = !!existing?.id;
      } else {
        const { data: existing } = await admin
          .from("influencer_reviews")
          .select("id")
          .eq("influencer_id", influencerId)
          .ilike("brand_email", brandEmail)
          .eq("project_type", BRAND_REVIEW_MARKER)
          .limit(1)
          .maybeSingle();
        alreadyReviewed = !!existing?.id;
      }

      const postUrl =
        typeof row.published_post_url === "string" ? row.published_post_url.trim() : "";
      const needsPostLink = party === "influencer" && !postUrl;
      const needsReview = !alreadyReviewed;
      if (!needsReview && !needsPostLink) continue;

      let creatorName: string | null = null;
      let profileUrl: string | null = null;
      if (party === "brand") {
        const { data: inf } = await admin
          .from("influencers")
          .select("display_name, profile_slug")
          .eq("id", influencerId)
          .maybeSingle();
        creatorName = inf?.display_name || null;
        profileUrl = publicProfilePath(
          typeof inf?.profile_slug === "string" ? inf.profile_slug : null,
          influencerId
        );
      }

      pending.push({
        proposalId: String(row.id),
        brandName: row.brand_name || brandEmail,
        creatorName,
        profileUrl,
        needsReview,
        needsPostLink,
        publishedPostUrl: postUrl || null,
      });
    }

    return NextResponse.json({ pending, party });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
