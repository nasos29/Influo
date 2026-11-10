/**
 * Render email HTML previews to disk. Does NOT send any email.
 * Usage: node --experimental-strip-types --import ./scripts/resolve-ts-imports.mjs scripts/render-email-previews.mts [outDir]
 */
import fs from "node:fs";
import path from "node:path";
import {
  acceptedToBrand,
  acceptedToCreator,
  applicationToBrand,
  applicationToCreator,
  applicationStatusToCreator,
  closedToBrand,
  closingSoonToBrand,
  deliverableReviewToCreator,
  deliverableSubmittedToBrand,
  newCampaignToCreator,
  notSelectedToCreator,
  pendingAppsReminderToBrand,
  publishedToAdmin,
  publishedToBrand,
  removedToCreator,
  reviewToCreator,
} from "../lib/campaignMail.ts";
import { campaignCategoryEmailHtml } from "../lib/zohoCampaignCategoryContent.ts";
import { announcementEmailHtml, dashboardPathForAudience } from "../lib/zohoAnnouncementContent.ts";
import { buildPasswordResetEmail } from "../lib/passwordResetEmail.ts";
import { buildSummaryEmail } from "../lib/messageSummary.ts";
import { buildAdminSummaryEmail } from "../lib/adminMessageSummary.ts";
import { buildStatsEmail } from "../lib/statsUpdateEmail.ts";
import { EMAIL_NEXT_STEPS, emailNextSteps, allEmailNextStepsKeys } from "../lib/emailNextSteps.ts";
import { shell, buttonHtml, siteUrl } from "../lib/proposalMail.ts";

const outDir = path.resolve(
  process.argv[2] || "C:\\Users\\Admin\\opdesk-handoff\\email-previews"
);
fs.mkdirSync(outDir, { recursive: true });

const campaignId = "11111111-1111-4111-8111-111111111111";
const brandEmail = "brand.preview@example.com";

type Preview = { file: string; subject?: string; html: string };

const previews: Preview[] = [
  {
    file: "campaign-new-creator.html",
    ...newCampaignToCreator({
      influencerName: "Μαρία Παπαδοπούλου",
      brandName: "Άθος Coffee",
      campaignTitle: "Reels για Γενικά",
      campaignId,
    }),
  },
  {
    file: "campaign-application-brand.html",
    ...applicationToBrand({
      brandEmail,
      brandName: "Άθος Coffee",
      campaignTitle: "Reels για Γενικά",
      influencerName: "Μαρία Παπαδοπούλου",
      message: "Θα φτιάξω 2 Reels με προϊόν στο μαγαζί.",
      proposedPrice: 180,
    }),
  },
  {
    file: "campaign-application-creator.html",
    ...applicationToCreator({
      influencerName: "Μαρία Παπαδοπούλου",
      campaignTitle: "Reels για Γενικά",
      brandName: "Άθος Coffee",
      campaignId,
      proposedPrice: 180,
    }),
  },
  {
    file: "campaign-published-brand.html",
    ...publishedToBrand({
      brandEmail,
      brandName: "Άθος Coffee",
      campaignTitle: "Reels για Γενικά",
      campaignId,
      budget: 500,
      closesAt: "2026-11-20T12:00:00.000Z",
    }),
  },
  {
    file: "campaign-published-admin.html",
    ...publishedToAdmin({
      campaignTitle: "Reels για Γενικά",
      brandName: "Άθος Coffee",
      campaignId,
      budget: 500,
    }),
  },
  {
    file: "campaign-shortlisted-creator.html",
    ...applicationStatusToCreator({
      influencerName: "Μαρία Παπαδοπούλου",
      campaignTitle: "Reels για Γενικά",
      campaignId,
      status: "shortlisted",
    }),
  },
  {
    file: "campaign-rejected-creator.html",
    ...applicationStatusToCreator({
      influencerName: "Μαρία Παπαδοπούλου",
      campaignTitle: "Reels για Γενικά",
      campaignId,
      status: "rejected",
    }),
  },
  {
    file: "campaign-accepted-creator.html",
    ...acceptedToCreator({
      influencerName: "Μαρία Παπαδοπούλου",
      brandName: "Άθος Coffee",
      campaignTitle: "Reels για Γενικά",
      budget: 180,
      proposalId: 42,
    }),
  },
  {
    file: "campaign-accepted-brand.html",
    ...acceptedToBrand({
      brandEmail,
      brandName: "Άθος Coffee",
      influencerName: "Μαρία Παπαδοπούλου",
      campaignTitle: "Reels για Γενικά",
      budget: 180,
      proposalId: 42,
    }),
  },
  {
    file: "campaign-review-creator.html",
    ...reviewToCreator({
      influencerName: "Μαρία Παπαδοπούλου",
      brandName: "Άθος Coffee",
      rating: 5,
      reviewText: "Εξαιρετική συνεργασία.",
      profileUrl: "https://www.influo.gr/in/maria",
    }),
  },
  {
    file: "campaign-removed-creator.html",
    ...removedToCreator({
      influencerName: "Μαρία Παπαδοπούλου",
      campaignTitle: "Reels για Γενικά",
    }),
  },
  {
    file: "campaign-closed-brand.html",
    ...closedToBrand({
      brandEmail,
      brandName: "Άθος Coffee",
      campaignTitle: "Reels για Γενικά",
      applicationsCount: 12,
    }),
  },
  {
    file: "campaign-not-selected-creator.html",
    ...notSelectedToCreator({
      influencerName: "Μαρία Παπαδοπούλου",
      campaignTitle: "Reels για Γενικά",
      brandName: "Άθος Coffee",
    }),
  },
  {
    file: "campaign-closing-soon-brand.html",
    ...closingSoonToBrand({
      brandEmail,
      brandName: "Άθος Coffee",
      campaignTitle: "Reels για Γενικά",
      closesAt: "2026-11-12T12:00:00.000Z",
      applicationsCount: 8,
    }),
  },
  {
    file: "campaign-pending-apps-brand.html",
    ...pendingAppsReminderToBrand({
      brandEmail,
      brandName: "Άθος Coffee",
      campaignTitle: "Reels για Γενικά",
      pendingCount: 17,
      oldestDays: 11,
    }),
  },
  {
    file: "campaign-deliverable-brand.html",
    ...deliverableSubmittedToBrand({
      brandEmail,
      brandName: "Άθος Coffee",
      campaignTitle: "Reels για Γενικά",
      influencerName: "Μαρία Παπαδοπούλου",
      deliverableUrl: "https://instagram.com/reel/example",
    }),
  },
  {
    file: "campaign-deliverable-approved-creator.html",
    ...deliverableReviewToCreator({
      influencerName: "Μαρία Παπαδοπούλου",
      brandName: "Άθος Coffee",
      campaignTitle: "Reels για Γενικά",
      status: "approved",
      reviewNote: "Τέλεια!",
    }),
  },
  {
    file: "campaign-deliverable-changes-creator.html",
    ...deliverableReviewToCreator({
      influencerName: "Μαρία Παπαδοπούλου",
      brandName: "Άθος Coffee",
      campaignTitle: "Reels για Γενικά",
      status: "changes_requested",
      reviewNote: "Άλλαξε το CTA στο τέλος.",
    }),
  },
  {
    file: "campaign-category-resend.html",
    subject: "Νέα καμπάνια στο Influo: Reels για Γενικά",
    html: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px;">
  <p>Γεια σου Μαρία,</p>
  <p>Άνοιξε νέα καμπάνια στο Influo που σχετίζεται με την κατηγορία σου.</p>
  <p><strong>Καμπάνια:</strong> Reels για Γενικά<br/><strong>Επιχείρηση:</strong> Άθος Coffee<br/><strong>Πλατφόρμες:</strong> Instagram, TikTok</p>
  <p><a href="https://www.influo.gr/campaigns/${campaignId}">https://www.influo.gr/campaigns/${campaignId}</a></p>
  ${emailNextSteps("campaign_category_bulk")}
</div>`,
  },
  {
    file: "campaign-category-zoho.html",
    subject: "Νέα καμπάνια στο Influo: Reels για Γενικά",
    html: campaignCategoryEmailHtml({
      title: "Reels για Γενικά",
      brandName: "Άθος Coffee",
      campaignId,
      siteUrl: "https://www.influo.gr",
    }),
  },
  {
    file: "zoho-announcement-creators.html",
    subject: "Υπάρχει μια νέα ανακοίνωση στο Influo",
    html: announcementEmailHtml(dashboardPathForAudience("creators"), "https://www.influo.gr"),
  },
  {
    file: "zoho-announcement-brands.html",
    subject: "Υπάρχει μια νέα ανακοίνωση στο Influo",
    html: announcementEmailHtml(dashboardPathForAudience("brands"), "https://www.influo.gr"),
  },
  {
    file: "password-reset-el.html",
    ...buildPasswordResetEmail("https://www.influo.gr/reset?token=preview", "el"),
  },
  {
    file: "password-reset-en.html",
    ...buildPasswordResetEmail("https://www.influo.gr/reset?token=preview", "en"),
  },
  {
    file: "message-summary.html",
    ...buildSummaryEmail({
      count: 2,
      counterpartName: "Άθος Coffee",
      previews: ["Γεια σου, μπορούμε να μιλήσουμε για το brief;", "Τέλεια, στέλνω links."],
      link: "https://www.influo.gr/dashboard?tab=messages",
    }),
  },
  {
    file: "admin-message-summary.html",
    ...buildAdminSummaryEmail({
      influencerName: "Μαρία Παπαδοπούλου",
      brandName: "Άθος Coffee",
      count: 3,
      previews: ["Brand: Γεια", "Creator: Ναι"],
      link: "https://www.influo.gr/admin",
      ended: false,
    }),
  },
  {
    file: "stats-update.html",
    ...buildStatsEmail({
      name: "Μαρία",
      slug: "maria",
      influencerId: campaignId,
      rows: [{ platform: "instagram", followers: 12500, diff: 320, er: 3.2, avgViews: 4100 }],
      topPostsAdded: true,
      showTip: true,
    }),
  },
  {
    file: "top10-congrats.html",
    subject: "Είσαι στο Top 10!",
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h1>Είσαι στο Top 10!</h1>
      <p>Γεια σου Μαρία — το προφίλ σου μπήκε στα Top 10.</p>
      <p><a href="https://www.influo.gr/in/maria">Δες το προφίλ σου</a></p>
      ${emailNextSteps("top10_congrats")}
    </div>`,
  },
  {
    file: "brand-weekly-digest.html",
    subject: "Νέα προφίλ influencers",
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <p>Γεια σας Άθος Coffee,</p>
      <p>Αυτή την εβδομάδα εγκρίθηκαν νέα προφίλ influencers.</p>
      ${emailNextSteps("brand_weekly_digest")}
    </div>`,
  },
  {
    file: "proposal-new-creator-sample.html",
    subject: "Νέα πρόταση συνεργασίας",
    html: shell(
      "Νέα πρόταση συνεργασίας",
      `<p>Γεια σου Μαρία,</p>
       <p>Η <strong>Άθος Coffee</strong> σού έστειλε πρόταση συνεργασίας.</p>
       ${buttonHtml(`${siteUrl()}/dashboard?tab=proposals`, "Δες την πρόταση")}
       ${emailNextSteps("proposal_new_creator")}`
    ),
  },
  {
    file: "profile-approved-sample.html",
    subject: "Το προφίλ σου εγκρίθηκε",
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h1>Είσαι Live!</h1>
      <p>Το προφίλ σου εγκρίθηκε.</p>
      ${emailNextSteps("profile_approved")}
    </div>`,
  },
  {
    file: "brand-verified-sample.html",
    subject: "Η επιχείρησή σας επαληθεύτηκε",
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <p>Η επιχείρηση επαληθεύτηκε.</p>
      ${emailNextSteps("brand_verified")}
    </div>`,
  },
];

// Also dump every catalog key as a standalone box for QA.
for (const key of allEmailNextStepsKeys()) {
  previews.push({
    file: `next-steps-${key}.html`,
    subject: key,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:24px auto;padding:16px;">
      <h2 style="font-size:16px;">${key}</h2>
      <p style="color:#64748b;font-size:12px;">${EMAIL_NEXT_STEPS[key].length} steps</p>
      ${emailNextSteps(key)}
    </div>`,
  });
}

let written = 0;
for (const p of previews) {
  const doc = `<!DOCTYPE html>
<html lang="el"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${(p.subject || p.file).replace(/</g, "")}</title>
<style>body{margin:0;background:#f8fafc;padding:16px;} .meta{font:12px/1.4 sans-serif;color:#64748b;margin:0 0 12px;}</style>
</head><body>
<p class="meta">${p.file}${p.subject ? ` · ${p.subject}` : ""} · preview only · no email sent</p>
${p.html}
</body></html>`;
  fs.writeFileSync(path.join(outDir, p.file), doc, "utf8");
  written += 1;
}

console.log(JSON.stringify({ outDir, written }, null, 2));
