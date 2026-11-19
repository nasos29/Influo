import type { SupabaseClient } from "@supabase/supabase-js";
import { auditGenderBucket } from "@/lib/auditGemini";
import { BRAND_REVIEW_MARKER, CREATOR_TARGET_REVIEW_FILTER } from "@/lib/brandReview";
import { isCollabEmailExcludedInfluencer } from "@/lib/collabEmailExclusion";
import { campaignRealCompletionAt } from "@/lib/campaignDealCompletion";
import {
  campaignPublishDeadline,
  shouldSendSideCampaignReviewReminder,
  shouldSendSideCampaignSecondReviewReminder,
} from "@/lib/campaignReviewReminder";
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
  shouldSendSideReviewReminder,
  shouldSendSideSecondReviewReminder,
} from "@/lib/reviewReminder";
import {
  effectiveFirstReminderSentAt,
  effectiveSecondReminderSentAt,
  type ReminderStampRow,
  type ReviewPartySide,
} from "@/lib/reviewReminderStamps";

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
  brand_review_reminder_sent_at?: string | null;
  influencer_review_reminder_sent_at?: string | null;
  brand_review_reminder_second_sent_at?: string | null;
  influencer_review_reminder_second_sent_at?: string | null;
  brand_review_prompts_declined_at?: string | null;
  influencer_review_prompts_declined_at?: string | null;
  status?: string | null;
};

const SELECT_COLS =
  "id, influencer_id, brand_name, brand_email, service_type, budget, counter_proposal_budget, counter_proposal_status, selected_extras, publish_deadline, agreement_accepted_at, delivery_confirmed_at, auto_completed_at, review_reminder_sent_at, review_reminder_second_sent_at, brand_review_reminder_sent_at, influencer_review_reminder_sent_at, brand_review_reminder_second_sent_at, influencer_review_reminder_second_sent_at, brand_review_prompts_declined_at, influencer_review_prompts_declined_at, status";

const SELECT_COLS_LEGACY =
  "id, influencer_id, brand_name, brand_email, service_type, budget, counter_proposal_budget, counter_proposal_status, selected_extras, publish_deadline, agreement_accepted_at, review_reminder_sent_at, review_reminder_second_sent_at, brand_review_prompts_declined_at, influencer_review_prompts_declined_at, status";

function dealAmount(row: ReviewReminderRow): string {
  if (row.counter_proposal_status === "accepted" && row.counter_proposal_budget) {
    return String(row.counter_proposal_budget);
  }
  return String(row.budget || "");
}

function starUrlsFor(
  source: "proposal" | "campaign",
  collabId: string | number,
  party: "brand" | "influencer"
): string[] {
  return [1, 2, 3, 4, 5].map((rating) =>
    reviewOpenUrl(source, String(collabId), party, rating, "el")
  );
}

type CampaignReviewRow = {
  id: string;
  influencer_id: string;
  status?: string | null;
  proposed_price?: number | null;
  delivery_confirmed_at?: string | null;
  auto_completed_at?: string | null;
  deliverable_status?: string | null;
  reviewed_at?: string | null;
  review_reminder_sent_at?: string | null;
  review_reminder_second_sent_at?: string | null;
  brand_review_reminder_sent_at?: string | null;
  influencer_review_reminder_sent_at?: string | null;
  brand_review_reminder_second_sent_at?: string | null;
  influencer_review_reminder_second_sent_at?: string | null;
  brand_review_prompts_declined_at?: string | null;
  influencer_review_prompts_declined_at?: string | null;
  brand_campaigns?: {
    title?: string | null;
    deadline?: string | null;
    brands?: { brand_name?: string | null; contact_email?: string | null } | Array<{
      brand_name?: string | null;
      contact_email?: string | null;
    }> | null;
  } | null;
};

const CAMPAIGN_REVIEW_SELECT =
  "id, influencer_id, status, proposed_price, delivery_confirmed_at, auto_completed_at, deliverable_status, reviewed_at, review_reminder_sent_at, review_reminder_second_sent_at, brand_review_reminder_sent_at, influencer_review_reminder_sent_at, brand_review_reminder_second_sent_at, influencer_review_reminder_second_sent_at, brand_review_prompts_declined_at, influencer_review_prompts_declined_at, brand_campaigns ( title, deadline, brands ( brand_name, contact_email ) )";

/** Page size for reminder scans; every page is read (no per-run scan cap). */
const SCAN_PAGE = 500;

type PageQuery<T> = (
  from: number,
  to: number
) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Read all pages of a filtered query (rows that leave the filter just drop out). */
async function fetchAllPages<T>(build: PageQuery<T>): Promise<{ rows: T[]; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += SCAN_PAGE) {
    const { data, error } = await build(from, from + SCAN_PAGE - 1);
    if (error) return { rows, error };
    const page = data || [];
    rows.push(...page);
    if (page.length < SCAN_PAGE) return { rows, error: null };
  }
}

/**
 * First wave: only rows where a side that could still receive the email has a null per-side stamp.
 * Brand side needs an address (proposals) and no decline; creator side needs no decline.
 */
const PROPOSAL_FIRST_WAVE_PENDING =
  "and(brand_review_reminder_sent_at.is.null,brand_review_prompts_declined_at.is.null,brand_email.not.is.null),and(influencer_review_reminder_sent_at.is.null,influencer_review_prompts_declined_at.is.null)";
const CAMPAIGN_FIRST_WAVE_PENDING =
  "and(brand_review_reminder_sent_at.is.null,brand_review_prompts_declined_at.is.null),and(influencer_review_reminder_sent_at.is.null,influencer_review_prompts_declined_at.is.null)";
/** Second wave: a side has its first-wave stamp but no second-wave stamp (and has not declined). */
const SECOND_WAVE_PENDING =
  "and(brand_review_reminder_sent_at.not.is.null,brand_review_reminder_second_sent_at.is.null,brand_review_prompts_declined_at.is.null),and(influencer_review_reminder_sent_at.not.is.null,influencer_review_reminder_second_sent_at.is.null,influencer_review_prompts_declined_at.is.null)";

function helperHtml(party: "brand" | "influencer"): string {
  const text = party === "brand" ? REVIEW_HELPER_BRAND_EL : REVIEW_HELPER_CREATOR_EL;
  return `<p style="margin:12px 0;font-size:13px;color:#475569;">${text}</p>`;
}

type ReminderWave = "first" | "second";

function stampColumn(
  party: ReviewPartySide,
  wave: ReminderWave
): string {
  if (wave === "first") {
    return party === "brand" ? "brand_review_reminder_sent_at" : "influencer_review_reminder_sent_at";
  }
  return party === "brand" ? "brand_review_reminder_second_sent_at" : "influencer_review_reminder_second_sent_at";
}

async function stampProposalSideReminder(
  admin: SupabaseClient,
  proposalId: string | number,
  party: ReviewPartySide,
  wave: ReminderWave,
  sentAt: string
): Promise<boolean> {
  const col = stampColumn(party, wave);
  const { data, error } = await admin
    .from("proposals")
    .update({ [col]: sentAt })
    .eq("id", proposalId)
    .is(col, null)
    .select("id")
    .maybeSingle();
  if (error) {
    if (/schema cache|column|PGRST204|42703/i.test(error.message || "")) return false;
    console.error("[review-reminder] stamp failed", proposalId, col, error.message);
    return false;
  }
  return !!data?.id;
}

async function stampCampaignSideReminder(
  admin: SupabaseClient,
  applicationId: string,
  party: ReviewPartySide,
  wave: ReminderWave,
  sentAt: string
): Promise<boolean> {
  const col = stampColumn(party, wave);
  const { data, error } = await admin
    .from("campaign_applications")
    .update({ [col]: sentAt })
    .eq("id", applicationId)
    .is(col, null)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[review-reminder] campaign stamp failed", applicationId, col, error.message);
    return false;
  }
  return !!data?.id;
}

/** Stamp both sides after merged completion email (legacy helper). */
export async function claimReviewReminder(
  admin: SupabaseClient,
  proposalId: string | number,
  sentAt = new Date().toISOString()
): Promise<boolean> {
  const a = await stampProposalSideReminder(admin, proposalId, "brand", "first", sentAt);
  const b = await stampProposalSideReminder(admin, proposalId, "influencer", "first", sentAt);
  return a || b;
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

function campaignMeta(row: CampaignReviewRow): {
  brandName: string;
  brandEmail: string;
  title: string;
  deadline: string | null;
} {
  const campaign = row.brand_campaigns;
  const brandRaw = campaign?.brands;
  const brand = Array.isArray(brandRaw) ? brandRaw[0] : brandRaw;
  return {
    brandName: brand?.brand_name || "Επιχείρηση",
    brandEmail: (brand?.contact_email || "").trim(),
    title: campaign?.title || "Καμπάνια",
    deadline: campaign?.deadline || null,
  };
}

async function sendCampaignReminderWave(
  admin: SupabaseClient,
  row: CampaignReviewRow,
  wave: "first" | "second",
  /** Only sides the caller found due (per-side timing). */
  due: { influencer: boolean; brand: boolean }
): Promise<"sent" | "skipped" | "error"> {
  const meta = campaignMeta(row);
  const brandEmail = meta.brandEmail;
  const brandDeclined = !!row.brand_review_prompts_declined_at;
  const creatorDeclined = !!row.influencer_review_prompts_declined_at;

  try {
    const influencer = await influencerContact(row.influencer_id);
    const bits = await creatorProfileBits(admin, row.influencer_id);
    const common = {
      proposalId: row.id,
      service: meta.title,
      budget: row.proposed_price != null ? String(row.proposed_price) : "",
      publishDeadline: campaignPublishDeadline(null, meta.deadline),
      isSecond: wave === "second",
    };
    const sentAt = new Date().toISOString();
    const outcomes: Array<"ok" | "skipped" | "quota" | "error"> = [];
    const stampRow = row as ReminderStampRow;
    const creatorDone =
      creatorDeclined || (brandEmail ? await creatorAlreadyReviewedBrand(admin, row.influencer_id, brandEmail) : false);
    const brandDone =
      brandDeclined || (brandEmail ? await brandAlreadyReviewed(admin, row.influencer_id, brandEmail) : true);

    const creatorStamped =
      wave === "first"
        ? !!effectiveFirstReminderSentAt("influencer", stampRow)
        : !!effectiveSecondReminderSentAt("influencer", stampRow);
    const brandStamped =
      wave === "first"
        ? !!effectiveFirstReminderSentAt("brand", stampRow)
        : !!effectiveSecondReminderSentAt("brand", stampRow);

    if (due.influencer && !creatorDone && !creatorStamped) {
      const creatorPrefs = await loadNotificationPreferences(admin, "influencer", row.influencer_id);
      if (allowRemindersEmail(creatorPrefs)) {
        const outcome = await mailCreatorReviewReminder({
          ...common,
          influencerId: row.influencer_id,
          dealRef: `campaign:${row.id}`,
          source: "campaign",
          to: influencer.email,
          creatorName: influencer.name,
          brandName: meta.brandName,
          profileUrl: bits.profileUrl,
          dashboardUrl: reviewOpenUrl("campaign", String(row.id), "influencer", 5, "el"),
          starUrls: starUrlsFor("campaign", row.id, "influencer"),
          declineUrl: reviewDeclineUrl("campaign", String(row.id), "influencer", "el"),
          helperHtml: helperHtml("influencer"),
        });
        if (outcome === "ok") await stampCampaignSideReminder(admin, row.id, "influencer", wave, sentAt);
        outcomes.push(outcome === "skipped" ? "skipped" : outcome);
      }
    }

    if (due.brand && brandEmail && !brandDone && !brandStamped) {
      if (await brandAllowsRemindersEmail(admin, brandEmail)) {
        const outcome = await mailBrandReviewReminder({
          ...common,
          dealRef: `campaign:${row.id}`,
          source: "campaign",
          to: brandEmail,
          brandName: meta.brandName,
          creatorName: influencer.name,
          creatorFemale: bits.creatorFemale,
          reviewUrl: reviewOpenUrl("campaign", String(row.id), "brand", 5, "el"),
          starUrls: starUrlsFor("campaign", row.id, "brand"),
          declineUrl: reviewDeclineUrl("campaign", String(row.id), "brand", "el"),
          helperHtml: helperHtml("brand"),
        });
        if (outcome === "ok") await stampCampaignSideReminder(admin, row.id, "brand", wave, sentAt);
        outcomes.push(outcome);
      }
    }

    if (outcomes.length === 0) return "skipped";
    if (outcomes.some((o) => o === "ok")) return "sent";
    if (outcomes.some((o) => o === "quota" || o === "error")) return "error";
    return "skipped";
  } catch (err) {
    const message = err instanceof Error ? err.message : "send failed";
    console.error("[review-reminder] campaign send", row.id, message);
    throw err;
  }
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

async function sendProposalSideReminder(
  admin: SupabaseClient,
  row: ReviewReminderRow,
  wave: SendWave,
  party: ReviewPartySide
): Promise<"ok" | "skipped" | "quota" | "error"> {
  const brandEmail = (row.brand_email || "").trim();
  const stampRow = row as ReminderStampRow;
  if (wave === "first" && effectiveFirstReminderSentAt(party, stampRow)) return "skipped";
  if (wave === "second") {
    if (!effectiveFirstReminderSentAt(party, stampRow)) return "skipped";
    if (effectiveSecondReminderSentAt(party, stampRow)) return "skipped";
  }

  const brandDeclined = !!row.brand_review_prompts_declined_at;
  const creatorDeclined = !!row.influencer_review_prompts_declined_at;
  const influencer = await influencerContact(row.influencer_id);
  const bits = await creatorProfileBits(admin, row.influencer_id);
  const common = {
    proposalId: row.id,
    service: row.service_type || "",
    budget: dealAmount(row),
    extras: row.selected_extras,
    publishDeadline: row.publish_deadline,
    isSecond: wave === "second",
    dealRef: row.id,
    source: "proposal" as const,
  };
  const sentAt = new Date().toISOString();

  if (party === "influencer") {
    if (creatorDeclined) return "skipped";
    if (brandEmail && (await creatorAlreadyReviewedBrand(admin, row.influencer_id, brandEmail))) {
      return "skipped";
    }
    const creatorPrefs = await loadNotificationPreferences(admin, "influencer", row.influencer_id);
    if (!allowRemindersEmail(creatorPrefs)) return "skipped";
    const outcome = await mailCreatorReviewReminder({
      ...common,
      influencerId: row.influencer_id,
      to: influencer.email,
      creatorName: influencer.name,
      brandName: row.brand_name || "Επιχείρηση",
      profileUrl: bits.profileUrl,
      dashboardUrl: reviewOpenUrl("proposal", String(row.id), "influencer", 5, "el"),
      starUrls: starUrlsFor("proposal", row.id, "influencer"),
      declineUrl: reviewDeclineUrl("proposal", String(row.id), "influencer", "el"),
      helperHtml: helperHtml("influencer"),
    });
    if (outcome === "ok") await stampProposalSideReminder(admin, row.id, "influencer", wave, sentAt);
    return outcome === "skipped" ? "skipped" : outcome;
  }

  if (!brandEmail || brandDeclined) return "skipped";
  if (await brandAlreadyReviewed(admin, row.influencer_id, brandEmail)) return "skipped";
  if (!(await brandAllowsRemindersEmail(admin, brandEmail))) return "skipped";
  const outcome = await mailBrandReviewReminder({
    ...common,
    to: brandEmail,
    brandName: row.brand_name || "Επιχείρηση",
    creatorName: influencer.name,
    creatorFemale: bits.creatorFemale,
    reviewUrl: reviewOpenUrl("proposal", String(row.id), "brand", 5, "el"),
    starUrls: starUrlsFor("proposal", row.id, "brand"),
    declineUrl: reviewDeclineUrl("proposal", String(row.id), "brand", "el"),
    helperHtml: helperHtml("brand"),
  });
  if (outcome === "ok") await stampProposalSideReminder(admin, row.id, "brand", wave, sentAt);
  return outcome;
}

async function sendReminderWave(
  admin: SupabaseClient,
  row: ReviewReminderRow,
  wave: SendWave,
  /** Only sides the caller found due (per-side timing). */
  due: { influencer: boolean; brand: boolean }
): Promise<"sent" | "skipped" | "error"> {
  try {
    const outcomes: Array<"ok" | "skipped" | "quota" | "error"> = [
      due.influencer ? await sendProposalSideReminder(admin, row, wave, "influencer") : "skipped",
      due.brand ? await sendProposalSideReminder(admin, row, wave, "brand") : "skipped",
    ];
    if (outcomes.length === 0) return "skipped";
    if (outcomes.some((o) => o === "ok")) return "sent";
    if (outcomes.every((o) => o === "skipped")) return "skipped";
    if (outcomes.some((o) => o === "quota" || o === "error")) return "error";
    return "skipped";
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
  opts?: { nowMs?: number }
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
    const { rows: pageRows, error } = await fetchAllPages<ReviewReminderRow>((from, to) => {
      const base = admin.from("proposals").select(SELECT_COLS).eq("status", "completed");
      if (fromRealCompletion) {
        // Real completion only — skip legacy completed-without-confirmation (no spam).
        // One or= param so both groups are ANDed explicitly.
        return base
          .or(
            `and(or(${PROPOSAL_FIRST_WAVE_PENDING}),or(delivery_confirmed_at.not.is.null,auto_completed_at.not.is.null))`
          )
          .order("delivery_confirmed_at", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: ReviewReminderRow[] | null; error: { message: string } | null }>;
      }
      return base
        .or(PROPOSAL_FIRST_WAVE_PENDING)
        .not("agreement_accepted_at", "is", null)
        .order("agreement_accepted_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: ReviewReminderRow[] | null; error: { message: string } | null }>;
    });
    const data = pageRows;

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
      if (isCollabEmailExcludedInfluencer(row.influencer_id)) {
        skipped += 1;
        continue;
      }
      const realAt = realCompletionAt(row);
      const stampRow = row as ReminderStampRow;
      const needsInfluencer = shouldSendSideReviewReminder("influencer", {
        status: row.status,
        row: stampRow,
        publishDeadline: row.publish_deadline,
        agreementAcceptedAt: row.agreement_accepted_at,
        realCompletedAt: realAt,
        nowMs,
        fromRealCompletion,
      });
      const needsBrand = shouldSendSideReviewReminder("brand", {
        status: row.status,
        row: stampRow,
        publishDeadline: row.publish_deadline,
        agreementAcceptedAt: row.agreement_accepted_at,
        realCompletedAt: realAt,
        nowMs,
        fromRealCompletion,
      });
      if (!needsInfluencer && !needsBrand) continue;
      due += 1;

      try {
        const outcome = await sendReminderWave(admin, row, "first", { influencer: needsInfluencer, brand: needsBrand });
        if (outcome === "sent") sent += 1;
        else if (outcome === "error") errors.push(`#${row.id}: send failed`);
        else skipped += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "send failed";
        errors.push(`#${row.id}: ${message}`);
      }
    }
  }

  // ——— Campaign applications: first wave ———
  {
    const { rows: data, error } = await fetchAllPages<CampaignReviewRow>(
      (from, to) =>
        admin
          .from("campaign_applications")
          .select(CAMPAIGN_REVIEW_SELECT)
          .or(
            `and(or(${CAMPAIGN_FIRST_WAVE_PENDING}),or(delivery_confirmed_at.not.is.null,auto_completed_at.not.is.null,deliverable_status.eq.approved))`
          )
          .neq("status", "cancelled")
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: CampaignReviewRow[] | null; error: { message: string } | null }>
    );
    if (error) {
      if (!/review_reminder|review_prompts_declined|schema cache|column|PGRST204|42703/i.test(error.message || "")) {
        errors.push(`campaign review: ${error.message}`);
      }
    } else {
      for (const row of data) {
        if (isCollabEmailExcludedInfluencer(row.influencer_id)) {
          skipped += 1;
          continue;
        }
        const realAt = campaignRealCompletionAt(row);
        const stampRow = row as ReminderStampRow;
        const publishDeadline = campaignPublishDeadline(null, campaignMeta(row).deadline);
        const needsInfluencer = shouldSendSideCampaignReviewReminder("influencer", {
          status: row.status,
          row: stampRow,
          publishDeadline,
          realCompletedAt: realAt,
          nowMs,
          fromRealCompletion: fromRealCompletion || true,
        });
        const needsBrand = shouldSendSideCampaignReviewReminder("brand", {
          status: row.status,
          row: stampRow,
          publishDeadline,
          realCompletedAt: realAt,
          nowMs,
          fromRealCompletion: fromRealCompletion || true,
        });
        if (!needsInfluencer && !needsBrand) continue;
        scanned += 1;
        due += 1;
        try {
          const outcome = await sendCampaignReminderWave(admin, row, "first", { influencer: needsInfluencer, brand: needsBrand });
          if (outcome === "sent") sent += 1;
          else if (outcome === "error") errors.push(`campaign #${row.id}: send failed`);
          else skipped += 1;
        } catch (err) {
          errors.push(`campaign #${row.id}: ${err instanceof Error ? err.message : "fail"}`);
        }
      }
    }
  }

  // ——— Second wave (7 days after first) — gated off by default ———
  if (!secondWaveEnabled) {
    return { scanned, due, sent, skipped, secondDue, secondSent, secondWaveEnabled, errors };
  }

  {
    const { rows: data, error } = await fetchAllPages<ReviewReminderRow>(
      (from, to) =>
        admin
          .from("proposals")
          .select(SELECT_COLS)
          .eq("status", "completed")
          .or(SECOND_WAVE_PENDING)
          .order("delivery_confirmed_at", { ascending: true, nullsFirst: false })
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: ReviewReminderRow[] | null; error: { message: string } | null }>
    );

    if (error) {
      if (/review_reminder_second|review_prompts_declined|schema cache|column|PGRST204|42703/i.test(error.message)) {
        // Migration not applied — skip second wave silently.
        return { scanned, due, sent, skipped, secondDue, secondSent, secondWaveEnabled, errors };
      }
      errors.push(error.message);
      return { scanned, due, sent, skipped, secondDue, secondSent, secondWaveEnabled, errors };
    }

    const secondRows = data;
    scanned += secondRows.length;

    for (const row of secondRows) {
      if (isCollabEmailExcludedInfluencer(row.influencer_id)) continue;
      const realAt = realCompletionAt(row);
      const stampRow = row as ReminderStampRow;
      const needsInfluencer = shouldSendSideSecondReviewReminder("influencer", {
        status: row.status,
        row: stampRow,
        publishDeadline: row.publish_deadline,
        realCompletedAt: realAt,
        nowMs,
        fromRealCompletion,
      });
      const needsBrand = shouldSendSideSecondReviewReminder("brand", {
        status: row.status,
        row: stampRow,
        publishDeadline: row.publish_deadline,
        realCompletedAt: realAt,
        nowMs,
        fromRealCompletion,
      });
      if (!needsInfluencer && !needsBrand) continue;
      secondDue += 1;

      try {
        const outcome = await sendReminderWave(admin, row, "second", { influencer: needsInfluencer, brand: needsBrand });
        if (outcome === "sent") secondSent += 1;
        else if (outcome === "error") errors.push(`#${row.id} second: send failed`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "send failed";
        errors.push(`#${row.id} second: ${message}`);
      }
    }
  }

  {
    const { rows: data, error } = await fetchAllPages<CampaignReviewRow>(
      (from, to) =>
        admin
          .from("campaign_applications")
          .select(CAMPAIGN_REVIEW_SELECT)
          .or(SECOND_WAVE_PENDING)
          .neq("status", "cancelled")
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: CampaignReviewRow[] | null; error: { message: string } | null }>
    );
    if (error) {
      if (!/review_reminder|review_prompts_declined|schema cache|column|PGRST204|42703/i.test(error.message || "")) {
        errors.push(`campaign review second: ${error.message}`);
      }
    } else {
      for (const row of data) {
        if (isCollabEmailExcludedInfluencer(row.influencer_id)) continue;
        const stampRow = row as ReminderStampRow;
        const secondGate = {
          status: row.status,
          row: stampRow,
          nowMs,
          publishDeadline: campaignPublishDeadline(null, row.brand_campaigns?.deadline ?? null),
          realCompletedAt: campaignRealCompletionAt(row),
          fromRealCompletion: isReviewFromRealCompletionEnabled(),
        };
        const needsInfluencer = shouldSendSideCampaignSecondReviewReminder("influencer", secondGate);
        const needsBrand = shouldSendSideCampaignSecondReviewReminder("brand", secondGate);
        if (!needsInfluencer && !needsBrand) continue;
        scanned += 1;
        secondDue += 1;
        try {
          const outcome = await sendCampaignReminderWave(admin, row, "second", { influencer: needsInfluencer, brand: needsBrand });
          if (outcome === "sent") secondSent += 1;
          else if (outcome === "error") errors.push(`campaign #${row.id} second: send failed`);
        } catch (err) {
          errors.push(`campaign #${row.id} second: ${err instanceof Error ? err.message : "fail"}`);
        }
      }
    }
  }

  return { scanned, due, sent, skipped, secondDue, secondSent, secondWaveEnabled, errors };
}
