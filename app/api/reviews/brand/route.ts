import { NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { BRAND_REVIEW_MARKER, isBrandTargetReview } from "@/lib/brandReview";
import { loadChatActor } from "@/lib/chatActor";
import { send, siteUrl, shell, buttonHtml } from "@/lib/proposalMail";
import { escapeHtml } from "@/lib/proposalParty";
import { deferAfterResponse } from "@/lib/proposalNotify";

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function normEmail(value: unknown): string {
  return asString(value).trim().toLowerCase();
}

/** GET ?brandEmail=… — public verified reviews of a brand (from creators). */
export async function GET(req: Request) {
  try {
    const brandEmail = normEmail(new URL(req.url).searchParams.get("brandEmail"));
    if (!brandEmail || !brandEmail.includes("@")) {
      return NextResponse.json({ error: "brandEmail required" }, { status: 400 });
    }
    const admin = supabaseService();
    const { data, error } = await admin
      .from("influencer_reviews")
      .select("id, influencer_id, brand_name, brand_email, rating, review_text, created_at, verified, project_type")
      .ilike("brand_email", brandEmail)
      .eq("project_type", BRAND_REVIEW_MARKER)
      .eq("verified", true)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const ids = [...new Set((data || []).map((r) => String(r.influencer_id)).filter(Boolean))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: creators } = await admin.from("influencers").select("id, display_name").in("id", ids);
      for (const c of creators || []) names.set(String(c.id), c.display_name || "Creator");
    }

    const reviews = (data || []).map((r) => ({
      id: r.id,
      brand_email: r.brand_email,
      brand_name: r.brand_name,
      rating: r.rating,
      review_text: r.review_text,
      created_at: r.created_at,
      influencer_id: r.influencer_id,
      influencer_name: names.get(String(r.influencer_id)) || "Creator",
    }));
    return NextResponse.json({ reviews });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST — creator reviews a brand after a completed Influo agreement. */
export async function POST(req: Request) {
  try {
    const user = await userFromBearer(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const actor = await loadChatActor(user);
    if (!actor.influencerId) {
      return NextResponse.json({ error: "Creator account required" }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const lang = asString(body.lang).trim() || "el";
    const brandEmail = normEmail(body.brandEmail);
    const brandName = asString(body.brandName).trim() || brandEmail;
    const reviewTextRaw = asString(body.reviewText).trim();
    const ratingRaw = body.rating;
    const ratingNum =
      typeof ratingRaw === "number" && Number.isFinite(ratingRaw)
        ? ratingRaw
        : parseInt(asString(ratingRaw).trim(), 10);

    if (!brandEmail || !brandEmail.includes("@")) {
      return NextResponse.json(
        { error: lang === "el" ? "Λείπει το email της επιχείρησης." : "Brand email missing." },
        { status: 400 }
      );
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

    const admin = supabaseService();
    const influencerId = actor.influencerId;

    const { data: proposals } = await admin
      .from("proposals")
      .select("id, brand_email, influencer_agreement_accepted, brand_agreement_accepted, status")
      .eq("influencer_id", influencerId)
      .in("status", ["completed", "accepted"]);

    const matched = (proposals || []).filter((p) => normEmail(p.brand_email) === brandEmail);
    const hasAgreement = matched.some(
      (p) => p.influencer_agreement_accepted === true && p.brand_agreement_accepted === true
    );
    if (!hasAgreement) {
      return NextResponse.json(
        {
          error:
            lang === "el"
              ? "Μπορείτε να αξιολογήσετε μόνο επιχειρήσεις με ολοκληρωμένη συμφωνία στο Influo."
              : "You can only review brands after a completed Influo agreement.",
        },
        { status: 403 }
      );
    }

    const { data: existingRows } = await admin
      .from("influencer_reviews")
      .select("id, project_type")
      .eq("influencer_id", influencerId)
      .ilike("brand_email", brandEmail);

    if ((existingRows || []).some((r) => isBrandTargetReview(r.project_type))) {
      return NextResponse.json(
        {
          error:
            lang === "el"
              ? "Έχετε ήδη αξιολογήσει αυτή την επιχείρηση."
              : "You have already reviewed this brand.",
        },
        { status: 400 }
      );
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
          project_type: BRAND_REVIEW_MARKER,
          verified: true,
        },
      ])
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    deferAfterResponse(async () => {
      try {
        const { data: brand } = await admin
          .from("brands")
          .select("brand_name, contact_email")
          .ilike("contact_email", brandEmail)
          .maybeSingle();
        const to = brand?.contact_email || brandEmail;
        const name = brand?.brand_name || brandName;
        const { data: creator } = await admin
          .from("influencers")
          .select("display_name")
          .eq("id", influencerId)
          .maybeSingle();
        const creatorName = creator?.display_name || "Ένας δημιουργός";
        const stars = "★".repeat(Math.max(1, Math.min(5, Math.round(ratingNum))));
        await send(
          "review_brand",
          to,
          `Νέα αξιολόγηση για την επιχείρησή σας στο Influo`,
          shell(
            "Νέα αξιολόγηση",
            `<p>Γεια σας ${escapeHtml(name)},</p>
             <p>Ο/Η <strong>${escapeHtml(creatorName)}</strong> άφησε αξιολόγηση για τη συνεργασία σας: <strong>${stars}</strong> (${ratingNum}/5).</p>
             ${reviewTextRaw ? `<p style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">${escapeHtml(reviewTextRaw)}</p>` : ""}
             ${buttonHtml(`${siteUrl()}/brand/dashboard?tab=statistics`, "Άνοιγμα πίνακα")}`
          )
        );
      } catch (err) {
        console.error("[brand review notify]", err);
      }
    });

    return NextResponse.json({ success: true, review });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error";
    console.error("Brand review POST", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
