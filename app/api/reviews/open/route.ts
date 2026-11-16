import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { publicProfilePath } from "@/lib/profileSlug";
import { parseReviewOpenToken, reviewOpenDestination } from "@/lib/reviewInvite";
import { siteUrl } from "@/lib/proposalMail";

export const runtime = "nodejs";

/** GET ?t=… — validate signed review-open token and return destination path. */
export async function GET(req: Request) {
  try {
    const t = new URL(req.url).searchParams.get("t") || "";
    const payload = parseReviewOpenToken(t);
    if (!payload || payload.source !== "proposal") {
      return NextResponse.json(
        { error: "Ο σύνδεσμος αξιολόγησης δεν είναι έγκυρος." },
        { status: 400 }
      );
    }

    const admin = supabaseService();
    const { data: proposal } = await admin
      .from("proposals")
      .select("id, influencer_id, status, brand_review_prompts_declined_at, influencer_review_prompts_declined_at")
      .eq("id", payload.id)
      .maybeSingle();

    if (!proposal) {
      return NextResponse.json(
        { error: "Η συνεργασία δεν βρέθηκε." },
        { status: 404 }
      );
    }

    const declined =
      payload.party === "brand"
        ? !!proposal.brand_review_prompts_declined_at
        : !!proposal.influencer_review_prompts_declined_at;
    if (declined) {
      return NextResponse.json(
        { error: "Έχετε ήδη επιλέξει να μην αξιολογήσετε αυτή τη συνεργασία." },
        { status: 410 }
      );
    }

    let profileUrl: string | null = null;
    if (payload.party === "brand" && proposal.influencer_id) {
      const { data: inf } = await admin
        .from("influencers")
        .select("profile_slug")
        .eq("id", proposal.influencer_id)
        .maybeSingle();
      const slug = typeof inf?.profile_slug === "string" ? inf.profile_slug : null;
      profileUrl = `${siteUrl()}${publicProfilePath(slug, proposal.influencer_id)}`;
    }

    const destination = reviewOpenDestination(payload, { profileUrl });
    // Client navigates relative paths; strip site origin if present.
    const path = destination.startsWith("http")
      ? destination.replace(siteUrl(), "") || "/"
      : destination;

    return NextResponse.json({
      ok: true,
      party: payload.party,
      rating: payload.rating,
      proposalId: payload.id,
      destination: path,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
