import assert from "node:assert/strict";
import test from "node:test";
import {
  EMAIL_NEXT_STEPS,
  allEmailNextStepsKeys,
  emailNextSteps,
  nextStepsHtml,
  type EmailNextStepsKey,
} from "../lib/emailNextSteps.ts";
import {
  acceptedToBrand,
  acceptedToCreator,
  applicationToBrand,
  applicationToCreator,
  closedToBrand,
  closingSoonToBrand,
  deliverableReviewToCreator,
  deliverableSubmittedToBrand,
  newCampaignToCreator,
  notSelectedToCreator,
  pendingAppsReminderToBrand,
  publishedToAdmin,
  publishedToBrand,
} from "../lib/campaignMail.ts";
import { campaignCategoryEmailHtml } from "../lib/zohoCampaignCategoryContent.ts";
import { announcementEmailHtml } from "../lib/zohoAnnouncementContent.ts";
import { buildPasswordResetEmail } from "../lib/passwordResetEmail.ts";
import { buildSummaryEmail } from "../lib/messageSummary.ts";
import { buildAdminSummaryEmail } from "../lib/adminMessageSummary.ts";
import { buildStatsEmail } from "../lib/statsUpdateEmail.ts";

const BOX = "Τι κάνω τώρα;";
const BOX_EN = "What to do next";

test("nextStepsHtml renders bilingual boxed steps and caps at 4", () => {
  const html = nextStepsHtml([
    { el: "Βήμα ένα", en: "Step one" },
    { el: "Βήμα δύο", en: "Step two" },
    { el: "Βήμα τρία", en: "Step three" },
    { el: "Βήμα τέσσερα", en: "Step four" },
    { el: "Extra", en: "Extra" },
  ]);
  assert.match(html, new RegExp(BOX));
  assert.match(html, new RegExp(BOX_EN));
  assert.match(html, /Βήμα ένα/);
  assert.match(html, /Step one/);
  assert.doesNotMatch(html, /Extra/);
  assert.match(html, /role="note"/);
  assert.equal(nextStepsHtml([]), "");
});

test("catalog covers every key with 1–4 bilingual steps", () => {
  const keys = allEmailNextStepsKeys();
  assert.ok(keys.length >= 40);
  for (const key of keys) {
    const steps = EMAIL_NEXT_STEPS[key];
    assert.ok(steps.length >= 1 && steps.length <= 4, key);
    for (const step of steps) {
      assert.ok(step.el.trim(), `${key} missing el`);
      assert.ok(step.en.trim(), `${key} missing en`);
    }
    const html = emailNextSteps(key);
    assert.match(html, new RegExp(BOX), key);
    assert.match(html, new RegExp(BOX_EN), key);
  }
});

test("campaign mail templates include next-steps box", () => {
  const samples: Array<{ name: string; html: string }> = [
    {
      name: "newCampaignToCreator",
      html: newCampaignToCreator({
        influencerName: "Μαρία",
        brandName: "Brand",
        campaignTitle: "Reels",
        campaignId: "11111111-1111-4111-8111-111111111111",
      }).html,
    },
    {
      name: "applicationToBrand",
      html: applicationToBrand({
        brandEmail: "b@example.com",
        brandName: "Brand",
        campaignTitle: "Reels",
        influencerName: "Μαρία",
      }).html,
    },
    {
      name: "applicationToCreator",
      html: applicationToCreator({
        influencerName: "Μαρία",
        campaignTitle: "Reels",
        brandName: "Brand",
        campaignId: "11111111-1111-4111-8111-111111111111",
      }).html,
    },
    {
      name: "publishedToBrand",
      html: publishedToBrand({
        brandEmail: "b@example.com",
        brandName: "Brand",
        campaignTitle: "Reels",
        campaignId: "11111111-1111-4111-8111-111111111111",
      }).html,
    },
    {
      name: "publishedToAdmin",
      html: publishedToAdmin({
        campaignTitle: "Reels",
        brandName: "Brand",
        campaignId: "11111111-1111-4111-8111-111111111111",
      }).html,
    },
    {
      name: "acceptedToCreator",
      html: acceptedToCreator({
        influencerName: "Μαρία",
        brandName: "Brand",
        campaignTitle: "Reels",
        budget: 200,
      }).html,
    },
    {
      name: "acceptedToBrand",
      html: acceptedToBrand({
        brandEmail: "b@example.com",
        brandName: "Brand",
        influencerName: "Μαρία",
        campaignTitle: "Reels",
        budget: 200,
      }).html,
    },
    {
      name: "closingSoonToBrand",
      html: closingSoonToBrand({
        brandEmail: "b@example.com",
        brandName: "Brand",
        campaignTitle: "Reels",
        closesAt: "2026-11-12T12:00:00.000Z",
        applicationsCount: 3,
      }).html,
    },
    {
      name: "closedToBrand",
      html: closedToBrand({
        brandEmail: "b@example.com",
        brandName: "Brand",
        campaignTitle: "Reels",
        applicationsCount: 3,
      }).html,
    },
    {
      name: "notSelectedToCreator",
      html: notSelectedToCreator({
        influencerName: "Μαρία",
        campaignTitle: "Reels",
        brandName: "Brand",
      }).html,
    },
    {
      name: "pendingAppsReminderToBrand",
      html: pendingAppsReminderToBrand({
        brandEmail: "b@example.com",
        brandName: "Brand",
        campaignTitle: "Reels",
        pendingCount: 2,
        oldestDays: 4,
      }).html,
    },
    {
      name: "deliverableSubmittedToBrand",
      html: deliverableSubmittedToBrand({
        brandEmail: "b@example.com",
        brandName: "Brand",
        campaignTitle: "Reels",
        influencerName: "Μαρία",
        deliverableUrl: "https://example.com/d",
      }).html,
    },
    {
      name: "deliverableReviewToCreator-approved",
      html: deliverableReviewToCreator({
        influencerName: "Μαρία",
        brandName: "Brand",
        campaignTitle: "Reels",
        status: "approved",
      }).html,
    },
    {
      name: "deliverableReviewToCreator-changes",
      html: deliverableReviewToCreator({
        influencerName: "Μαρία",
        brandName: "Brand",
        campaignTitle: "Reels",
        status: "changes_requested",
        reviewNote: "Fix caption",
      }).html,
    },
  ];
  for (const sample of samples) {
    assert.match(sample.html, new RegExp(BOX), sample.name);
    assert.match(sample.html, new RegExp(BOX_EN), sample.name);
  }
});

test("bulk / zoho / password / summary / digest templates include next-steps", () => {
  // Resend category builder embeds the same shared box (avoid importing queue/Zoho deps here).
  assert.match(emailNextSteps("campaign_category_bulk"), new RegExp(BOX));
  assert.match(
    campaignCategoryEmailHtml({
      title: "Reels",
      brandName: "Brand",
      campaignId: "11111111-1111-4111-8111-111111111111",
      siteUrl: "https://www.influo.gr",
    }),
    new RegExp(BOX)
  );
  assert.match(announcementEmailHtml("/dashboard", "https://www.influo.gr"), new RegExp(BOX));
  assert.match(buildPasswordResetEmail("https://www.influo.gr/reset", "el").html, new RegExp(BOX));
  assert.match(buildPasswordResetEmail("https://www.influo.gr/reset", "en").html, new RegExp(BOX));
  assert.match(
    buildSummaryEmail({
      count: 2,
      counterpartName: "Brand",
      previews: ["Γεια"],
      link: "https://www.influo.gr/messages",
    }).html,
    new RegExp(BOX)
  );
  assert.match(
    buildAdminSummaryEmail({
      influencerName: "Μαρία",
      brandName: "Brand",
      count: 2,
      previews: ["Γεια"],
      link: "https://www.influo.gr/admin",
      ended: false,
    }).html,
    new RegExp(BOX)
  );
  assert.match(
    buildStatsEmail({
      name: "Μαρία",
      slug: "maria",
      influencerId: "11111111-1111-4111-8111-111111111111",
      rows: [{ platform: "instagram", followers: 1000, diff: 10, er: null, avgViews: null }],
      topPostsAdded: false,
      showTip: false,
    }).html,
    new RegExp(BOX)
  );
  // Top10 / weekly digest HTML builders pull Next.js graph; assert shared box keys instead.
  assert.match(emailNextSteps("top10_congrats"), new RegExp(BOX));
  assert.match(emailNextSteps("brand_weekly_digest"), new RegExp(BOX));
});

test("snapshot: new-campaign creator next-steps copy is stable", () => {
  const key: EmailNextStepsKey = "campaign_new_creator";
  assert.deepEqual(EMAIL_NEXT_STEPS[key], [
    { el: "Άνοιξε τον σύνδεσμο της καμπάνιας.", en: "Open the campaign link." },
    {
      el: "Πάτα «Αίτηση», γράψε ένα σύντομο μήνυμα και (αν ζητείται) τιμή/δείγματα.",
      en: "Tap Apply, add a short message and price/samples if asked.",
    },
    {
      el: "Η επιχείρηση θα δει την αίτησή σου· θα λάβεις email όταν αλλάξει κατάσταση.",
      en: "The brand will review it; you’ll get an email when status changes.",
    },
  ]);
});
