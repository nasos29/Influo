import { supabaseService } from "@/lib/apiAuth";
import { BRAND_REVIEW_MARKER, CREATOR_TARGET_REVIEW_FILTER } from "@/lib/brandReview";
import { reviewsAggregateJsonLd, type JsonLdReview } from "@/lib/reviewsJsonLd";

export async function creatorReviewsJsonLd(
  influencerId: string,
  itemName: string,
  itemUrl: string
): Promise<Record<string, unknown> | null> {
  const admin = supabaseService();
  const [{ data: stats }, { data: rows }] = await Promise.all([
    admin
      .from("influencers")
      .select("avg_rating, total_reviews")
      .eq("id", influencerId)
      .maybeSingle(),
    admin
      .from("influencer_reviews")
      .select("id, rating, review_text, created_at, brand_name")
      .eq("influencer_id", influencerId)
      .eq("verified", true)
      .or(CREATOR_TARGET_REVIEW_FILTER)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const total = Number(stats?.total_reviews) || 0;
  const avg = Number(stats?.avg_rating) || 0;
  if (total <= 0 || avg <= 0) return null;
  const reviews: JsonLdReview[] = (rows || []).map((r) => ({
    id: String(r.id),
    rating: Number(r.rating) || 0,
    review_text: r.review_text,
    created_at: r.created_at,
    authorName: (r.brand_name || "Brand").trim() || "Brand",
  }));
  return reviewsAggregateJsonLd({
    itemType: "Service",
    providerName: itemName,
    itemName,
    itemUrl,
    avgRating: avg,
    totalReviews: total,
    reviews,
  });
}

export async function brandReviewsJsonLdById(
  brandId: string,
  itemUrl: string
): Promise<Record<string, unknown> | null> {
  const id = brandId.trim();
  if (!id) return null;
  const admin = supabaseService();
  const { data: brand } = await admin
    .from("brands")
    .select("brand_name, contact_email, avg_rating, total_reviews")
    .eq("id", id)
    .maybeSingle();
  const email = (brand?.contact_email || "").trim();
  if (!email) return null;
  return brandReviewsJsonLd(email, (brand?.brand_name || "Brand").trim() || "Brand", itemUrl);
}

export async function brandReviewsJsonLd(
  brandEmail: string,
  itemName: string,
  itemUrl: string
): Promise<Record<string, unknown> | null> {
  const email = brandEmail.trim().toLowerCase();
  if (!email) return null;
  const admin = supabaseService();
  const [{ data: brandRow }, { data: rows }] = await Promise.all([
    admin.from("brands").select("avg_rating, total_reviews").ilike("contact_email", email).maybeSingle(),
    admin
      .from("influencer_reviews")
      .select("id, rating, review_text, created_at, influencers ( display_name )")
      .ilike("brand_email", email)
      .eq("project_type", BRAND_REVIEW_MARKER)
      .eq("verified", true)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const total = Number(brandRow?.total_reviews) || 0;
  const avg = Number(brandRow?.avg_rating) || 0;
  if (total <= 0 || avg <= 0) return null;
  const reviews: JsonLdReview[] = (rows || []).map((r) => {
    const inf = r.influencers as { display_name?: string | null } | { display_name?: string | null }[] | null;
    const name = Array.isArray(inf) ? inf[0]?.display_name : inf?.display_name;
    return {
      id: String(r.id),
      rating: Number(r.rating) || 0,
      review_text: r.review_text,
      created_at: r.created_at,
      authorName: (name || "Creator").trim() || "Creator",
    };
  });
  return reviewsAggregateJsonLd({
    itemType: "Organization",
    itemName,
    itemUrl,
    avgRating: avg,
    totalReviews: total,
    reviews,
  });
}