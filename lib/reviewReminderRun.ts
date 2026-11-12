import type { SupabaseClient } from "@supabase/supabase-js";
import { auditGenderBucket } from "@/lib/auditGemini";
import { CREATOR_TARGET_REVIEW_FILTER } from "@/lib/brandReview";
import { influencerContact } from "@/lib/proposalAccess";
import { mailBrandReviewReminder, mailCreatorReviewReminder, siteUrl } from "@/lib/proposalMail";
import { publicProfilePath } from "@/lib/profileSlug";
import { shouldSendReviewReminder } from "@/lib/reviewReminder";

export type ReviewReminderRow = {
  id: string | number;
  influencer_id: string;
  brand_name: string | null;
  brand_email: string | null;
  service_type: string | null;
  budget: string | null;
  counter_proposal_budget?: string | null;
  counter_proposal_status?: string | null;
  selected_extras?: unknown;
  publish_deadline?: string | null;
  agreement_accepted_at?: string | null;
  review_reminder_sent_at?: string | null;
  status?: string | null;
};

const SELECT_COLS =
  "id, influencer_id, brand_name, brand_email, service_type, budget, counter_proposal_budget, counter_proposal_status, selected_extras, publish_deadline, agreement_accepted_at, review_reminder_sent_at, status";

function dealAmount(row: ReviewReminderRow): string {
  if (row.counter_proposal_status === "accepted" && row.counter_proposal_budget) {
    return String(row.counter_proposal_budget);
  }
  return String(row.budget || "");
}

/** Claim one proposal for the review reminder (null → already claimed / missing). */
export async function claimReviewReminder(
  admin: SupabaseClient,
  proposalId: string | number,
  sentAt = new Date().toISOString()
): Promise<boolean> {
  const { data, error } = await admin
    .from("proposals")
    .update({ review_reminder_sent_at: sentAt })
    .eq("id", proposalId)
    .is("review_reminder_sent_at", null)
    .eq("status", "completed")
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[review-reminder] claim failed", proposalId, error.message);
    return false;
  }
  return !!data?.id;
}

/** Undo claim so a later cron can retry after a send failure. */
async function releaseReviewReminderClaim(admin: SupabaseClient, proposalId: string | number): Promise<void> {
  const { error } = await admin
    .from("proposals")
    .update({ review_reminder_sent_at: null })
    .eq("id", proposalId);
  if (error) console.error("[review-reminder] release failed", proposalId, error.message);
}

async function brandAlreadyReviewed(
  admin: SupabaseClient,
  influencerId: string,
  brandEmail: string
): Promise<boolean> {
  const email = brandEmail.trim();
  if (!email) return false;
  const { data, error } = await admin
    .from("influencer_reviews")
    .select("id")
    .eq("influencer_id", influencerId)
    .ilike("brand_email", email)
    .or(CREATOR_TARGET_REVIEW_FILTER)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[review-reminder] review lookup", error.message);
    return false;
  }
  return !!data?.id;
}

async function creatorProfileBits(
  admin: SupabaseClient,
  influencerId: string
): Promise<{ profileUrl: string; creatorFemale: boolean | null }> {
  const site = siteUrl();
  const row = await admin.from("influencers").select("profile_slug, gender").eq("id", influencerId).maybeSingle();
  const slug = !row.error && typeof row.data?.profile_slug === "string" ? row.data.profile_slug : null;
  const gender = auditGenderBucket(typeof row.data?.gender === "string" ? row.data.gender : null);
  return {
    profileUrl: `${site}${publicProfilePath(slug, influencerId)}`,
    creatorFemale: gender === "neutral" ? null : gender === "female",
  };
}

/**
 * Find due completed proposals and send one brand review reminder each.
 * Skips when the brand already left a review; still stamps so we don't retry forever.
 */
export async function runReviewReminders(
  admin: SupabaseClient,
  opts?: { limit?: number; nowMs?: number }
): Promise<{ scanned: number; due: number; sent: number; skipped: number; errors: string[] }> {
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
  const nowMs = opts?.nowMs ?? Date.now();
  const errors: string[] = [];

  const { data, error } = await admin
    .from("proposals")
    .select(SELECT_COLS)
    .eq("status", "completed")
    .is("review_reminder_sent_at", null)
    .not("agreement_accepted_at", "is", null)
    .order("agreement_accepted_at", { ascending: true })
    .limit(200);

  if (error) {
    return { scanned: 0, due: 0, sent: 0, skipped: 0, errors: [error.message] };
  }

  const rows = (data || []) as ReviewReminderRow[];
  let due = 0;
  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    if (sent + skipped >= limit) break;
    if (
      !shouldSendReviewReminder({
        status: row.status,
        reviewReminderSentAt: row.review_reminder_sent_at,
        publishDeadline: row.publish_deadline,
        agreementAcceptedAt: row.agreement_accepted_at,
        nowMs,
      })
    ) {
      continue;
    }
    due += 1;

    const claimed = await claimReviewReminder(admin, row.id);
    if (!claimed) {
      skipped += 1;
      continue;
    }

    const brandEmail = (row.brand_email || "").trim();
    try {
      const influencer = await influencerContact(row.influencer_id);
      const bits = await creatorProfileBits(admin, row.influencer_id);
      const common = {
        proposalId: row.id,
        service: row.service_type || "",
        budget: dealAmount(row),
        extras: row.selected_extras,
        publishDeadline: row.publish_deadline,
      };
      const jobs: Promise<void>[] = [
        mailCreatorReviewReminder({
          ...common,
          to: influencer.email,
          creatorName: influencer.name,
          brandName: row.brand_name || "Επιχείρηση",
          profileUrl: bits.profileUrl,
          dashboardUrl: `${siteUrl()}/dashboard?tab=proposals`,
        }),
      ];
      if (brandEmail && !(await brandAlreadyReviewed(admin, row.influencer_id, brandEmail))) {
        jobs.push(
          mailBrandReviewReminder({
            ...common,
            to: brandEmail,
            brandName: row.brand_name || "Επιχείρηση",
            creatorName: influencer.name,
            creatorFemale: bits.creatorFemale,
            reviewUrl: `${bits.profileUrl}?tab=reviews`,
          })
        );
      } else {
        skipped += 1;
      }
      await Promise.all(jobs);
      sent += 1;
    } catch (err) {
      await releaseReviewReminderClaim(admin, row.id);
      const message = err instanceof Error ? err.message : "send failed";
      errors.push(`#${row.id}: ${message}`);
      console.error("[review-reminder] send", row.id, message);
    }
  }

  return { scanned: rows.length, due, sent, skipped, errors };
}
