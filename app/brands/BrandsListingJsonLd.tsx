import { brandReviewsJsonLdById } from "@/lib/loadPublicReviewsJsonLd";
import { supabaseService } from "@/lib/apiAuth";
import { absoluteUrl } from "@/lib/site";

/** AggregateRating JSON-LD for brands listed on /brands (count > 0). */
export default async function BrandsListingJsonLd() {
  const admin = supabaseService();
  const { data } = await admin
    .from("brands")
    .select("id")
    .gt("total_reviews", 0)
    .order("total_reviews", { ascending: false })
    .limit(24);
  const blocks: Record<string, unknown>[] = [];
  const base = absoluteUrl("/brands");
  for (const row of data || []) {
    const id = String(row.id || "");
    if (!id) continue;
    const ld = await brandReviewsJsonLdById(id, `${base}#brand-${id}`);
    if (ld) blocks.push(ld);
  }
  if (!blocks.length) return null;
  const payload = blocks.length === 1 ? blocks[0] : { "@context": "https://schema.org", "@graph": blocks };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload).replace(/</g, "\\u003c") }}
    />
  );
}