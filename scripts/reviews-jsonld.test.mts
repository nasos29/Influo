import assert from "node:assert/strict";
import test from "node:test";
import { reviewsAggregateJsonLd } from "../lib/reviewsJsonLd.ts";
import { shouldSendSideReviewReminder } from "../lib/reviewReminder.ts";

test("reviews JSON-LD: none without reviews; Organization / Service with provider", () => {
  assert.equal(
    reviewsAggregateJsonLd({ itemName: "X", itemUrl: "https://influo.gr/x", avgRating: 0, totalReviews: 0, reviews: [] }),
    null
  );
  const brand = reviewsAggregateJsonLd({
    itemType: "Organization",
    itemName: "Brand",
    itemUrl: "https://influo.gr/brands#brand-1",
    avgRating: 4.5,
    totalReviews: 2,
    reviews: [{ id: "1", rating: 5, authorName: "Creator", review_text: "Great" }],
  }) as Record<string, any>;
  assert.equal(brand["@type"], "Organization");
  assert.equal(brand.aggregateRating.reviewCount, 2);
  assert.equal(brand.review[0].reviewRating.ratingValue, 5);
  const creator = reviewsAggregateJsonLd({
    itemType: "Service",
    providerName: "Maria",
    itemName: "Maria",
    itemUrl: "https://influo.gr/in/maria",
    avgRating: 5,
    totalReviews: 1,
    reviews: [],
  }) as Record<string, any>;
  assert.equal(creator["@type"], "Service");
  assert.equal(creator.provider.name, "Maria");
  assert.equal("review" in creator, false);
});

test("per-side first reminder: a stamped side is not due, the other side still is", () => {
  const row = {
    agreement_accepted_at: "2026-10-01T10:00:00.000Z",
    brand_review_reminder_sent_at: "2026-10-10T07:30:00.000Z",
    influencer_review_reminder_sent_at: null,
  };
  const base = {
    status: "completed",
    row,
    realCompletedAt: "2026-10-05T10:00:00.000Z",
    nowMs: Date.parse("2026-11-01T00:00:00.000Z"),
    fromRealCompletion: true,
  };
  assert.equal(shouldSendSideReviewReminder("brand", base), false);
  assert.equal(shouldSendSideReviewReminder("influencer", base), true);
});
