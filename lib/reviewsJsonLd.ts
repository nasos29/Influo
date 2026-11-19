/** schema.org AggregateRating + Review for public pages (count > 0 only). */

export type JsonLdReview = {
  id: string;
  rating: number;
  review_text?: string | null;
  created_at?: string | null;
  authorName: string;
};

export function reviewsAggregateJsonLd(input: {
  itemName: string;
  itemUrl: string;
  avgRating: number;
  totalReviews: number;
  reviews: JsonLdReview[];
}): Record<string, unknown> | null {
  if (input.totalReviews <= 0 || input.avgRating <= 0) return null;
  const reviewItems = input.reviews.slice(0, 20).map((r) => ({
    "@type": "Review",
    author: { "@type": "Person", name: r.authorName },
    datePublished: r.created_at || undefined,
    reviewBody: r.review_text || undefined,
    reviewRating: {
      "@type": "Rating",
      ratingValue: Math.min(5, Math.max(1, Math.round(r.rating))),
      bestRating: 5,
      worstRating: 1,
    },
  }));
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.itemName,
    url: input.itemUrl,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: input.avgRating,
      reviewCount: input.totalReviews,
      bestRating: 5,
      worstRating: 1,
    },
    ...(reviewItems.length ? { review: reviewItems } : {}),
  };
}