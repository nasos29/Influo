import assert from "node:assert/strict";
import test from "node:test";
import {
  REVIEW_REMINDER_SECOND_DAYS,
  shouldSendReviewReminder,
  shouldSendSecondReviewReminder,
} from "../lib/reviewReminder.ts";
import {
  parseReviewDeclineToken,
  parseReviewOpenToken,
  reviewDeclineToken,
  reviewDeclineUrl,
  reviewOpenDestination,
  reviewOpenLoginPath,
  reviewOpenToken,
  reviewOpenUrl,
} from "../lib/reviewInvite.ts";
import {
  REVIEW_HELPER_BRAND_EL,
  REVIEW_HELPER_CREATOR_EL,
  reviewHelperText,
} from "../lib/reviewCopy.ts";
import { reviewDeclineLinkHtml, reviewStarsHtml } from "../lib/proposalMail.ts";

test("second reminder is 7 days after first stamp", () => {
  assert.equal(REVIEW_REMINDER_SECOND_DAYS, 7);
  const first = "2026-11-01T10:00:00.000Z";
  assert.equal(
    shouldSendSecondReviewReminder({
      status: "completed",
      reviewReminderSentAt: first,
      nowMs: Date.parse("2026-11-07T09:59:00.000Z"),
    }),
    false
  );
  assert.equal(
    shouldSendSecondReviewReminder({
      status: "completed",
      reviewReminderSentAt: first,
      nowMs: Date.parse("2026-11-08T10:00:00.000Z"),
    }),
    true
  );
  assert.equal(
    shouldSendSecondReviewReminder({
      status: "completed",
      reviewReminderSentAt: first,
      reviewReminderSecondSentAt: "2026-11-08T12:00:00.000Z",
      nowMs: Date.parse("2026-11-20T10:00:00.000Z"),
    }),
    false
  );
  // First wave still gated.
  assert.equal(
    shouldSendReviewReminder({
      status: "completed",
      agreementAcceptedAt: "2026-10-01T10:00:00.000Z",
      reviewReminderSentAt: first,
      nowMs: Date.parse("2026-11-12T12:00:00.000Z"),
    }),
    false
  );
});

test("review open token round-trip with numeric proposal id + rating", () => {
  process.env.REVIEW_INVITE_SECRET = "test-review-secret";
  const token = reviewOpenToken("proposal", "93", "brand", 4);
  const parsed = parseReviewOpenToken(token);
  assert.deepEqual(parsed, {
    kind: "open",
    source: "proposal",
    id: "93",
    party: "brand",
    rating: 4,
  });
  assert.equal(parseReviewOpenToken(token.slice(0, -2) + "aa"), null);
  assert.equal(parseReviewOpenToken(""), null);
});

test("review decline token round-trip", () => {
  process.env.REVIEW_INVITE_SECRET = "test-review-secret";
  const token = reviewDeclineToken("proposal", "59", "influencer");
  assert.deepEqual(parseReviewDeclineToken(token), {
    kind: "decline",
    source: "proposal",
    id: "59",
    party: "influencer",
  });
});

test("review open login path by party", () => {
  const returnPath = "/reviews/open?t=abc&lang=en";
  assert.equal(
    reviewOpenLoginPath("brand", returnPath),
    `/brand/login?redirect=${encodeURIComponent(returnPath)}`
  );
  assert.equal(
    reviewOpenLoginPath("influencer", returnPath),
    `/login?redirect=${encodeURIComponent(returnPath)}`
  );
});

test("review open destination preserves rating", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://influo.gr";
  const brandDest = reviewOpenDestination(
    { kind: "open", source: "proposal", id: "12", party: "brand", rating: 3 },
    { profileUrl: "https://influo.gr/creator/demo" }
  );
  assert.match(brandDest, /tab=reviews/);
  assert.match(brandDest, /review=1/);
  assert.match(brandDest, /rating=3/);
  const creatorDest = reviewOpenDestination(
    { kind: "open", source: "proposal", id: "12", party: "influencer", rating: 5 },
    {}
  );
  assert.match(creatorDest, /reviewBrand=1/);
  assert.match(creatorDest, /rating=5/);
});

test("star + decline URLs and HTML helpers", () => {
  process.env.REVIEW_INVITE_SECRET = "test-review-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://influo.gr";
  const open = reviewOpenUrl("proposal", "12", "brand", 5);
  assert.match(open, /^https:\/\/influo\.gr\/reviews\/open\?/);
  const decline = reviewDeclineUrl("proposal", "12", "brand");
  assert.match(decline, /\/reviews\/decline\?/);
  const stars = reviewStarsHtml([
    reviewOpenUrl("proposal", "12", "brand", 1),
    reviewOpenUrl("proposal", "12", "brand", 2),
    reviewOpenUrl("proposal", "12", "brand", 3),
    reviewOpenUrl("proposal", "12", "brand", 4),
    reviewOpenUrl("proposal", "12", "brand", 5),
  ]);
  assert.match(stars, /★/);
  assert.match(stars, /reviews\/open/);
  const declineHtml = reviewDeclineLinkHtml(decline);
  assert.match(declineHtml, /Όχι, ευχαριστώ/);
  assert.match(declineHtml, /#9ca3af/);
  assert.doesNotMatch(declineHtml, /display:\s*inline-block|background:\s*#2563eb/i);
});

test("helper copy for both parties", () => {
  assert.match(REVIEW_HELPER_CREATOR_EL, /αναζητήσ/);
  assert.match(REVIEW_HELPER_BRAND_EL, /δημιουργοί|αξιόπιστος/);
  assert.equal(reviewHelperText("influencer", "el"), REVIEW_HELPER_CREATOR_EL);
  assert.equal(reviewHelperText("brand", "el"), REVIEW_HELPER_BRAND_EL);
});
