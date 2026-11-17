import type { SupabaseClient } from "@supabase/supabase-js";
import { auditGenderBucket } from "@/lib/auditGemini";
import { BRAND_REVIEW_MARKER, CREATOR_TARGET_REVIEW_FILTER } from "@/lib/brandReview";
import { isCollabEmailExcludedInfluencer } from "@/lib/collabEmailExclusion";
import { realCompletionAt } from "@/lib/deliveryCompletion";
import {
  allowRemindersEmail,
  loadNotificationPreferences,
} from "@/lib/notificationPreferences";
import { REVIEW_HELPER_BRAND_EL, REVIEW_HELPER_CREATOR_EL } from "@/lib/reviewCopy";
import { reviewDeclineUrl, reviewOpenUrl } from "@/lib/reviewInvite";
import { influencerContact } from "@/lib/proposalAccess";
import { mailBrandReviewReminder, mailCreatorReviewReminder, siteUrl } from "@/lib/proposalMail";
import { publicProfilePath } from "@/lib/profileSlug";
import {
  isReviewFromRealCompletionEnabled,
  isSecondReviewReminderWaveEnabled,
  shouldSendReviewReminder,
  shouldSendSecondReviewReminder,
} from "@/lib/reviewReminder";

export { isSecondReviewReminderWaveEnabled, isReviewFromRealCompletionEnabled };

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
  delivery_confirmed_at?: string | null;
  auto_completed_at?: string | null;
  review_reminder_sent_at?: string | null;
  review_reminder_second_sent_at?: string | null;
  brand_review_prompts_declined_at?: string | null;
  influencer_review_prompts_declined_at?: string | null;
  status?: string | null;
};

const SELECT_COLS =
  "id, influencer_id, brand_name, brand_email, service_type, budget, counter_proposal_budget, counter_proposal_status, selected_extras, publish_deadline, agreement_accepted_at, delivery_confirmed_at, auto_completed_at, review_reminder_sent_at, review_reminder_second_sent_at, brand_review_prompts_declined_at, influencer_review_prompts_declined_at, status";

const SELECT_COLS_LEGACY =
  "id, influencer_id, brand_name, brand_email, service_type, budget, counter_proposal_budget, counter_proposal_status, selected_extras, publish_deadline, agreement_accepted_at, review_reminder_sent_at, review_reminder_second_sent_at, brand_review_prompts_declined_at, influencer_review_prompts_declined_at, status";

function dealAmount(row: ReviewReminderRow): string {
  if (row.counter_proposal_status === "accepted" && row.counter_proposal_budget) {
    return String(row.counter_proposal_budget);
  }
  return String(row.budget || "");
}

function starUrlsFor(proposalId: string | number, party: "brand" | "influencer"): string[] {
  return [1, 2, 3, 4, 5].map((rating) =>
    reviewOpenUrl("proposal", String(proposalId), party, rating, "el")
  );
}

function helperHtml(party: "brand" | "influencer"): string {
  const text = party === "brand" ? REVIEW_HELPER_BRAND_EL : REVIEW_HELPER_CREATOR_EL;
  return `<p style="margin:12px 0;font-size:13px;color:#475569;">${text}</p>`;
}

/** Claim one proposal for the first review reminder (null → already claimed / missing). */
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

async function claimSecondReviewReminder(
  admin: SupabaseClient,
  proposalId: string | number,
  sentAt = new Date().toISOString()
): Promise<boolean> {
  const { data, error } = await admin
    .from("proposals")
    .update({ review_reminder_second_sent_at: sentAt })
    .eq("id", proposalId)
    .is("review_reminder_second_sent_at", null)
    .not("review_reminder_sent_at", "is", null)
    .eq("status", "completed")
    .select("id")
    .maybeSingle();
  if (error) {
    // Column may not exist until migration is applied.
    if (/review_reminder_second|schema cache|column|PGRST204|42703/i.test(error.message || "")) {
      console.warn("[review-reminder] second claim skipped (migration pending)", error.message);
      return false;
    }
    console.error("[review-reminder] second claim failed", proposalId, error.message);
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

async function releaseSecondReviewReminderClaim(
  admin: SupabaseClient,
  proposalId: string | number
): Promise<void> {
  const { error } = await admin
    .from("proposals")
    .update({ review_reminder_second_sent_at: null })
    .eq("id", proposalId);
  if (error) console.error("[review-reminder] second release failed", proposalId, error.message);
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

async function creatorAlreadyReviewedBrand(
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
    .eq("project_type", BRAND_REVIEW_MARKER)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[review-reminder] brand-review lookup", error.message);
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

async function brandAllowsRemindersEmail(
  admin: SupabaseClient,
  brandEmail: string
): Promise<boolean> {
  try {
    const brandId =
      (await admin.from("brands").select("id").ilike("contact_email", brandEmail).maybeSingle()).data
        ?.id || null;
    if (!brandId) return true;
    const brandPrefs = await loadNotificationPreferences(admin, "brand", String(brandId));
    return allowRemindersEmail(brandPrefs);
  } catch {
    return true;
  }
}

type SendWave = "first" | "second";

async function sendReminderWave(
  admin: SupabaseClient,
  row: ReviewReminderRow,
  wave: SendWave
): Promise<"sent" | "skipped" | "error"> {
  const brandEmail = (row.brand_email || "").trim();
  const brandDeclined = !!row.brand_review_prompts_declined_at;
  const creatorDeclined = !!row.influencer_review_prompts_declined_at;

  try {
    const influencer = await influencerContact(row.influencer_id);
    const bits = await creatorProfileBits(admin, row.influencer_id);
    const common = {
      proposalId: row.id,
      service: row.service_type || "",
      budget: dealAmount(row),
      extras: row.selected_extras,
      publishDeadline: row.publish_deadline,
      isSecond: wave === "second",
    };
    const jobs: Promise<void>[] = [];
    const creatorDone =
      creatorDeclined ||
      (brandEmail ? await creatorAlreadyReviewedBrand(admin, row.influencer_id, brandEmail) : false);
    const brandDone =
      brandDeclined ||
      (brandEmail ? await brandAlreadyReviewed(admin, row.influencer_id, brandEmail) : true);

    if (!creatorDone) {
      const creatorPrefs = await loadNotificationPreferences(admin, "influencer", row.influencer_id);
      if (allowRemindersEmail(creatorPrefs)) {
        jobs.push(
          mailCreatorReviewReminder({
            ...common,
            to: influencer.email,
            creatorName: influencer.name,
            brandName: row.brand_name || "Επιχείρηση",
            profileUrl: bits.profileUrl,
            dashboardUrl: `${siteUrl()}/dashboard?tab=proposals&reviewBrand=1&proposalId=${encodeURIComponent(String(row.id))}`,
            starUrls: starUrlsFor(row.id, "influencer"),
            declineUrl: reviewDeclineUrl("proposal", String(row.id), "influencer", "el"),
            helperHtml: helperHtml("influencer"),
          })
        );
      }
    }

    if (brandEmail && !brandDone) {
      if (await brandAllowsRemindersEmail(admin, brandEmail)) {
        jobs.push(
          mailBrandReviewReminder({
            ...common,
            to: brandEmail,
            brandName: row.brand_name || "Επιχείρηση",
            creatorName: influencer.name,
            creatorFemale: bits.creatorFemale,
            reviewUrl: `${bits.profileUrl}?tab=reviews&review=1&proposalId=${encodeURIComponent(String(row.id))}`,
            starUrls: starUrlsFor(row.id, "brand"),
            declineUrl: reviewDeclineUrl("proposal", String(row.id), "brand", "el"),
            helperHtml: helperHtml("brand"),
          })
        );
      }
    }

    if (jobs.length === 0) return "skipped";
    await Promise.all(jobs);
    return "sent";
  } catch (err) {
    const message = err instanceof Error ? err.message : "send failed";
    console.error("[review-reminder] send", row.id, message);
    throw err;
  }
}

/**
 * Find due completed proposals and send review reminders (first wave, then second).
 * Skips a side when that party already left a review, declined prompts, or opted out of reminder emails.
 * Second wave is gated by REVIEW_REMINDER_SECOND_WAVE (default off).
 */
export async function runReviewReminders(
  admin: SupabaseClient,
  opts?: { limit?: number; nowMs?: number }
): Promise<{
  scanned: number;
  due: number;
  sent: number;
  skipped: number;
  secondDue: number;
  secondSent: number;
  secondWaveEnabled: boolean;
  errors: string[];
}> {
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
  const nowMs = opts?.nowMs ?? Date.now();
  const errors: string[] = [];
  const secondWaveEnabled = isSecondReviewReminderWaveEnabled();
  const fromRealCompletion = isReviewFromRealCompletionEnabled();

  let scanned = 0;
  let due = 0;
  let sent = 0;
  let skipped = 0;
  let secondDue = 0;
  let secondSent = 0;

  // ——— First wave ———
  {
    let rows: ReviewReminderRow[] = [];
    let query = admin
      .from("proposals")
      .select(SELECT_COLS)
      .eq("status", "completed")
      .is("review_reminder_sent_at", null)
      .limit(200);

    if (fromRealCompletion) {
      // Real completion only — skip legacy completed-without-confirmation (no spam).
      query = query
        .or("delivery_confirmed_at.not.is.null,auto_completed_at.not.is.null")
        .order("delivery_confirmed_at", { ascending: true, nullsFirst: false });
    } else {
      query = query
        .not("agreement_accepted_at", "is", null)
        .order("agreement_accepted_at", { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      // Older DBs without new columns — retry with legacy select (and disable real-completion filter).
      if (
        /delivery_confirmed|auto_completed|review_reminder_second|review_prompts_declined|schema cache|column|PGRST204|42703/i.test(
          error.message
        )
      ) {
        const legacy = await admin
          .from("proposals")
          .select(SELECT_COLS_LEGACY)
          .eq("status", "completed")
          .is("review_reminder_sent_at", null)
          .not("agreement_accepted_at", "is", null)
          .order("agreement_accepted_at", { ascending: true })
          .limit(200);
        if (legacy.error) {
          return {
            scanned: 0,
            due: 0,
            sent: 0,
            skipped: 0,
            secondDue: 0,
            secondSent: 0,
            secondWaveEnabled,
            errors: [legacy.error.message],
          };
        }
        rows = (legacy.data || []) as ReviewReminderRow[];
      } else {
        return {
          scanned: 0,
          due: 0,
          sent: 0,
          skipped: 0,
          secondDue: 0,
          secondSent: 0,
          secondWaveEnabled,
          errors: [error.message],
        };
      }
    } else {
      rows = (data || []) as ReviewReminderRow[];
    }

    scanned += rows.length;

    for (const row of rows) {
      if (sent + skipped >= limit) break;
      if (isCollabEmailExcludedInfluencer(row.influencer_id)) {
        skipped += 1;
        continue;
      }
      const realAt = realCompletionAt(row);
      if (
        !shouldSendReviewReminder({
          status: row.status,
          reviewReminderSentAt: row.review_reminder_sent_at,
          publishDeadline: row.publish_deadline,
          agreementAcceptedAt: row.agreement_accepted_at,
          realCompletedAt: realAt,
          nowMs,
          fromRealCompletion,
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

      try {
        const outcome = await sendReminderWave(admin, row, "first");
        if (outcome === "sent") sent += 1;
        else skipped += 1;
      } catch (err) {
        await releaseReviewReminderClaim(admin, row.id);
        const message = err instanceof Error ? err.message : "send failed";
        errors.push(`#${row.id}: ${message}`);
      }
    }
  }

  // ——— Second wave (7 days after first) — gated off by default ———
  if (!secondWaveEnabled) {
    return { scanned, due, sent, skipped, secondDue, secondSent, secondWaveEnabled, errors };
  }

  {
    const { data, error } = await admin
      .from("proposals")
      .select(SELECT_COLS)
      .eq("status", "completed")
      .not("review_reminder_sent_at", "is", null)
      .is("review_reminder_second_sent_at", null)
      .order("review_reminder_sent_at", { ascending: true })
      .limit(200);

    if (error) {
      if (/review_reminder_second|review_prompts_declined|schema cache|column|PGRST204|42703/i.test(error.message)) {
        // Migration not applied — skip second wave silently.
        return { scanned, due, sent, skipped, secondDue, secondSent, secondWaveEnabled, errors };
      }
      errors.push(error.message);
      return { scanned, due, sent, skipped, secondDue, secondSent, secondWaveEnabled, errors };
    }

    const secondRows = (data || []) as ReviewReminderRow[];
    scanned += secondRows.length;

    for (const row of secondRows) {
      if (secondSent >= limit) break;
      if (isCollabEmailExcludedInfluencer(row.influencer_id)) continue;
      if (
        !shouldSendSecondReviewReminder({
          status: row.status,
          reviewReminderSentAt: row.review_reminder_sent_at,
          reviewReminderSecondSentAt: row.review_reminder_second_sent_at,
          nowMs,
        })
      ) {
        continue;
      }
      secondDue += 1;

      const claimed = await claimSecondReviewReminder(admin, row.id);
      if (!claimed) continue;

      try {
        const outcome = await sendReminderWave(admin, row, "second");
        if (outcome === "sent") secondSent += 1;
      } catch (err) {
        await releaseSecondReviewReminderClaim(admin, row.id);
        const message = err instanceof Error ? err.message : "send failed";
        errors.push(`#${row.id} second: ${message}`);
      }
    }
  }

  return { scanned, due, sent, skipped, secondDue, secondSent, secondWaveEnabled, errors };
}
