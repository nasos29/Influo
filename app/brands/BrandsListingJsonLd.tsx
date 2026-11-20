import { brandReviewsJsonLdById } from "@/lib/loadPublicReviewsJsonLd";
import { supabaseService } from "@/lib/apiAuth";
import { absoluteUrl } from "@/lib/site";

/** AggregateRating JSON-LD for brands listed on /brands (count > 0). */
export default async function BrandsListingJsonLd() {
  try {
    return await renderBrandsListingJsonLd();
  } catch {
    // SEO extra only: never break /brands when the DB is unreachable (e.g. at build time).
    return null;
  }
}

async function renderBrandsListingJsonLd() {
  const admin = supabaseService();
  const { data } = await admin
    .from("brands")
    .select("id")
    .gt("total_reviews", 0)
    .order("total_reviews", { ascending: false })
    .limit(24);
  const base = absoluteUrl("/brands");
  const ids = (data || []).map((row) => String(row.id || "")).filter(Boolean);
  const results = await Promise.all(
    ids.map((id) => brandReviewsJsonLdById(id, `${base}#brand-${id}`).catch(() => null))
  );
  const blocks = results.filter((ld): ld is Record<string, unknown> => !!ld);
  if (!blocks.length) return null;
  const payload = blocks.length === 1 ? blocks[0] : { "@context": "https://schema.org", "@graph": blocks };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload).replace(/</g, "\\u003c") }}
    />
  );
}