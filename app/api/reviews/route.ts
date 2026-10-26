import { NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function collabRequiredMessage(lang: string): string {
  return lang === "el"
    ? "Μπορείτε να αξιολογήσετε μόνο influencers με τους οποίους έχετε συνεργαστεί. Παρακαλώ ολοκληρώστε πρώτα μια συνεργασία. Μετράει και η εγκεκριμένη παράδοση σε καμπάνια μέσω Influo."
    : "You can only review influencers you have worked with. Please complete a collaboration first. An approved campaign deliverable through Influo also counts.";
}

function agreementRequiredMessage(lang: string): string {
  return lang === "el"
    ? "Μπορείτε να αξιολογήσετε μόνο μετά την αποδοχή της συμφωνίας συνεργασίας. Παρακαλώ περιμένετε να αποδεχτούν και οι δύο πλευρές την συμφωνία. Μετράει και η εγκεκριμένη παράδοση σε καμπάνια μέσω Influo."
    : "You can only review after the collaboration agreement has been accepted. Please wait for both parties to accept the agreement. An approved campaign deliverable through Influo also counts.";
}

export async function GET(req: Request) {
  try {
    const admin = supabaseService();
    const { searchParams } = new URL(req.url);
    const influencerId = searchParams.get("influencerId");

    if (!influencerId) {
      return NextResponse.json({ error: "influencerId required" }, { status: 400 });
    }

    const { data: reviews, error } = await admin
      .from("influencer_reviews")
      .select("id, influencer_id, brand_name, rating, review_text, project_type, created_at, verified")
      .eq("influencer_id", influencerId)
      .eq("verified", true)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const publicReviews = (reviews || []).map((review) => ({
      id: review.id,
      influencer_id: review.influencer_id,
      brand_name: review.brand_name || null,
      rating: review.rating,
      review_text: review.review_text,
      project_type: review.project_type,
      created_at: review.created_at,
      verified: review.verified,
    }));

    return NextResponse.json({ reviews: publicReviews });
  } catch (error: unknown) {
    console.error("Reviews GET error:", error);
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await userFromBearer(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseService();
    const { data: brand } = await admin
      .from("brands")
      .select("id, brand_name, contact_email")
      .eq("id", user.id)
      .maybeSingle();

    if (!brand || brand.id !== user.id) {
      return NextResponse.json({ error: "Brand not found" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    // Ignore brandEmail / brandName from the client — always from brands row.
    const influencerId = asString(body.influencerId).trim();
    const lang = asString(body.lang).trim() || "el";
    const projectType = asString(body.projectType).trim() || null;
    const reviewTextRaw = asString(body.reviewText).trim();
    const ratingRaw = body.rating;
    const ratingNum =
      typeof ratingRaw === "number" && Number.isFinite(ratingRaw)
        ? ratingRaw
        : parseInt(asString(ratingRaw).trim(), 10);

    const brandEmail = asString(brand.contact_email).trim().toLowerCase();
    const brandName = asString(brand.brand_name).trim() || brandEmail;

    if (!influencerId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!brandEmail) {
      return NextResponse.json({ error: "Brand email missing" }, { status: 400 });
    }
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json(
        {
          error:
            lang === "el"
              ? "Η βαθμολογία πρέπει να είναι ακέραιος από 1 έως 5."
              : "Rating must be an integer from 1 to 5.",
        },
        { status: 400 }
      );
    }
    if (reviewTextRaw.length > 1000) {
      return NextResponse.json(
        {
          error:
            lang === "el"
              ? "Το κείμενο αξιολόγησης δεν μπορεί να υπερβαίνει τους 1000 χαρακτήρες."
              : "Review text cannot exceed 1000 characters.",
        },
        { status: 400 }
      );
    }

    const { data: completedProposals } = await admin
      .from("proposals")
      .select("id, brand_email, influencer_agreement_accepted, brand_agreement_accepted, brand_added_to_past_brands")
      .eq("influencer_id", influencerId)
      .in("status", ["completed", "accepted"]);

    const matchedProposals = (completedProposals || []).filter(
      (p) => asString(p.brand_email).trim().toLowerCase() === brandEmail
    );

    const hasAcceptedAgreement = matchedProposals.some(
      (p) => p.influencer_agreement_accepted === true && p.brand_agreement_accepted === true
    );

    let eligibleViaCampaign = false;
    const { data: brandCampaigns } = await admin.from("brand_campaigns").select("id").eq("brand_id", brand.id);
    const campaignIds = (brandCampaigns || []).map((c) => c.id).filter(Boolean);
    if (campaignIds.length > 0) {
      const { data: apps } = await admin
        .from("campaign_applications")
        .select("id")
        .eq("influencer_id", influencerId)
        .in("campaign_id", campaignIds)
        .eq("status", "accepted")
        .eq("deliverable_status", "approved")
        .limit(1);
      eligibleViaCampaign = !!(apps && apps.length > 0);
    }

    if (!hasAcceptedAgreement && !eligibleViaCampaign) {
      if (matchedProposals.length === 0) {
        return NextResponse.json({ error: collabRequiredMessage(lang) }, { status: 403 });
      }
      return NextResponse.json({ error: agreementRequiredMessage(lang) }, { status: 403 });
    }

    const { data: existingReview } = await admin
      .from("influencer_reviews")
      .select("id")
      .eq("influencer_id", influencerId)
      .ilike("brand_email", brandEmail)
      .maybeSingle();

    if (existingReview) {
      const errorMsg =
        lang === "el"
          ? "Έχετε ήδη αξιολογήσει αυτόν τον influencer. Μπορείτε να υποβάλετε μόνο μια αξιολόγηση ανά συνεργασία."
          : "You have already reviewed this influencer. You can only submit one review per collaboration.";
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { data: review, error: insertError } = await admin
      .from("influencer_reviews")
      .insert([
        {
          influencer_id: influencerId,
          brand_email: brandEmail,
          brand_name: brandName || brandEmail,
          rating: ratingNum,
          review_text: reviewTextRaw || null,
          project_type: projectType,
          verified: true,
        },
      ])
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const { data: allReviews } = await admin
      .from("influencer_reviews")
      .select("rating")
      .eq("influencer_id", influencerId);

    if (allReviews && allReviews.length > 0) {
      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      const totalReviews = allReviews.length;

      await admin
        .from("influencers")
        .update({
          avg_rating: Math.round(avgRating * 100) / 100,
          total_reviews: totalReviews,
        })
        .eq("id", influencerId);
    }

    return NextResponse.json({ success: true, review });
  } catch (error: unknown) {
    console.error("Reviews POST error:", error);
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
