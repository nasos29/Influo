/**
 * Orchestrate «Η συνεργασία ολοκληρώθηκε» emails + admin digest line.
 * Merges the review ask into the completion mail and stamps review_reminder_sent_at
 * on proposals so the delayed review cron does not send a second email.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { auditGenderBucket } from "@/lib/auditGemini";
import { enqueueAdminDigestItem } from "@/lib/adminDailyDigest";
import { isCollabEmailExcludedInfluencer } from "@/lib/collabEmailExclusion";
import { mailCollaborationCompleted } from "@/lib/collaborationCompleteMail";
import {
  allowRemindersEmail,
  loadNotificationPreferences,
} from "@/lib/notificationPreferences";
import { publicProfilePath } from "@/lib/profileSlug";
import { siteUrl } from "@/lib/proposalMail";
import { REVIEW_HELPER_BRAND_EL, REVIEW_HELPER_CREATOR_EL } from "@/lib/reviewCopy";
import { reviewDeclineUrl, reviewOpenUrl, type ReviewSource } from "@/lib/reviewInvite";
import { claimReviewReminder } from "@/lib/reviewReminderRun";

export type NotifyCollaborationCompleteInput = {
  source: ReviewSource;
  id: string | number;
  influencerId: string;
  brandName: string;
  brandEmail?: string | null;
  creatorName: string;
  creatorEmail?: string | null;
  mode: "confirmed" | "auto" | "admin";
  deliveryMode?: "link" | "event" | string | null;
  /** Stamp review_reminder_sent_at on proposals to avoid a second review email. */
  claimProposalReviewReminder?: boolean;
};

function starUrls(source: ReviewSource, id: string | number, party: "brand" | "influencer"): string[] {
  return [1, 2, 3, 4, 5].map((rating) =>
    reviewOpenUrl(source, String(id), party, rating, "el")
  );
}

async function creatorProfileBits(
  admin: SupabaseClient,
  influencerId: string
): Promise<{ profileUrl: string; creatorFemale: boolean | null }> {
  const row = await admin
    .from("influencers")
    .select("profile_slug, gender")
    .eq("id", influencerId)
    .maybeSingle();
  const slug =
    !row.error && typeof row.data?.profile_slug === "string" ? row.data.profile_slug : null;
  const gender = auditGenderBucket(typeof row.data?.gender === "string" ? row.data.gender : null);
  return {
    profileUrl: `${siteUrl()}${publicProfilePath(slug, influencerId)}`,
    creatorFemale: gender === "neutral" ? null : gender === "female",
  };
}

async function brandAllowsReminders(
  admin: SupabaseClient,
  brandEmail: string
): Promise<boolean> {
  try {
    const brandId =
      (await admin.from("brands").select("id").ilike("contact_email", brandEmail).maybeSingle()).data
        ?.id || null;
    if (!brandId) return true;
    const prefs = await loadNotificationPreferences(admin, "brand", String(brandId));
    return allowRemindersEmail(prefs);
  } catch {
    return true;
  }
}

/**
 * Send completion emails to creator + brand (when addressed), enqueue admin digest,
 * and claim proposal review reminder stamp when applicable.
 */
export async function notifyRealCollaborationComplete(
  admin: SupabaseClient,
  input: NotifyCollaborationCompleteInput
): Promise<{ emailed: number; skipped: boolean }> {
  const excluded = isCollabEmailExcludedInfluencer(input.influencerId);
  const brandEmail = (input.brandEmail || "").trim();
  const creatorEmail = (input.creatorEmail || "").trim();
  const bits = await creatorProfileBits(admin, input.influencerId);
  const article =
    bits.creatorFemale == null ? "τον/την" : bits.creatorFemale ? "την" : "τον";
  const collabLabel =
    input.source === "proposal" ? `#${input.id}` : `καμπάνια`;
  const creatorDash =
    input.source === "proposal"
      ? `${siteUrl()}/dashboard?tab=proposals`
      : `${siteUrl()}/dashboard?tab=campaigns`;
  const brandDash =
    input.source === "proposal"
      ? `${siteUrl()}/brand/dashboard?tab=proposals`
      : `${siteUrl()}/brand/dashboard?tab=campaigns`;
  const creatorReviewUrl = `${creatorDash}&reviewBrand=1&${
    input.source === "proposal" ? "proposalId" : "applicationId"
  }=${encodeURIComponent(String(input.id))}`;
  const brandReviewUrl = `${bits.profileUrl}?tab=reviews&review=1&${
    input.source === "proposal" ? "proposalId" : "applicationId"
  }=${encodeURIComponent(String(input.id))}`;

  let emailed = 0;
  const jobs: Promise<void>[] = [];

  if (!excluded && creatorEmail) {
    const creatorPrefs = await loadNotificationPreferences(
      admin,
      "influencer",
      input.influencerId
    );
    const includeReview = allowRemindersEmail(creatorPrefs);
    jobs.push(
      mailCollaborationCompleted({
        to: creatorEmail,
        party: "creator",
        creatorName: input.creatorName,
        brandName: input.brandName,
        mode: input.mode,
        deliveryMode: input.deliveryMode,
        collabLabel,
        dashboardUrl: creatorDash,
        reviewUrl: creatorReviewUrl,
        reviewCtaLabel: `Αξιολόγησε την ${input.brandName}`,
        starUrls: includeReview ? starUrls(input.source, input.id, "influencer") : undefined,
        declineUrl: includeReview
          ? reviewDeclineUrl(input.source, String(input.id), "influencer", "el")
          : null,
        helperHtml: includeReview
          ? `<p style="margin:12px 0;font-size:13px;color:#475569;">${REVIEW_HELPER_CREATOR_EL}</p>`
          : null,
        includeReview,
        profileUrl: bits.profileUrl,
      }).then(() => {
        emailed += 1;
      })
    );
  }

  if (brandEmail) {
    const includeReview = await brandAllowsReminders(admin, brandEmail);
    jobs.push(
      mailCollaborationCompleted({
        to: brandEmail,
        party: "brand",
        creatorName: input.creatorName,
        brandName: input.brandName,
        creatorFemale: bits.creatorFemale,
        mode: input.mode,
        deliveryMode: input.deliveryMode,
        collabLabel,
        dashboardUrl: brandDash,
        reviewUrl: brandReviewUrl,
        reviewCtaLabel: `Αξιολογήστε ${article} ${input.creatorName}`,
        starUrls: includeReview ? starUrls(input.source, input.id, "brand") : undefined,
        declineUrl: includeReview
          ? reviewDeclineUrl(input.source, String(input.id), "brand", "el")
          : null,
        helperHtml: includeReview
          ? `<p style="margin:12px 0;font-size:13px;color:#475569;">${REVIEW_HELPER_BRAND_EL}</p>`
          : null,
        includeReview,
      }).then(() => {
        emailed += 1;
      })
    );
  }

  if (jobs.length) {
    await Promise.all(jobs);
  }

  // Avoid a second delayed review email for proposals (merge was intentional).
  if (
    input.source === "proposal" &&
    input.claimProposalReviewReminder !== false
  ) {
    await claimReviewReminder(admin, input.id).catch(() => false);
  }

  try {
    await enqueueAdminDigestItem(admin, "collaboration_completed", {
      brandName: input.brandName,
      creatorName: input.creatorName,
      source: input.source,
      id: String(input.id),
      mode: input.mode,
      deliveryMode: input.deliveryMode || null,
    });
  } catch (err) {
    console.error(
      "[notifyCollaborationComplete] admin digest",
      err instanceof Error ? err.message : err
    );
  }

  return { emailed, skipped: excluded && !brandEmail };
}
