/**
 * Remind creators to submit deliverables around publish_deadline,
 * and brands to approve pending submissions after 2 days.
 * All gated by env flags (default OFF). Respects Maria Palli exclusion + reminder prefs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isCollabEmailExcludedInfluencer } from "@/lib/collabEmailExclusion";
import {
  BRAND_APPROVE_REMINDER_DAYS,
  DELIVERABLE_REMINDER_AFTER_1_DAYS,
  DELIVERABLE_REMINDER_AFTER_5_DAYS,
  DELIVERABLE_REMINDER_BEFORE_DAYS,
  DELIVERABLE_REMINDER_GENTLE_DAYS,
  isBrandApproveRemindersEnabled,
  isDeliverableRemindersEnabled,
} from "@/lib/deliveryFlags";
import { mailBrandApproveReminder, mailCreatorDeliverableReminder, siteUrl } from "@/lib/deliveryMail";
import {
  allowRemindersEmail,
  loadNotificationPreferences,
} from "@/lib/notificationPreferences";
import { influencerContact } from "@/lib/proposalAccess";
import { isCampaignRealDeliveryComplete } from "@/lib/campaignDealCompletion";
import { isCampaignReminderBacklog } from "@/lib/campaignReviewReminder";
import { publishDeadlineDueMs } from "@/lib/reviewReminder";

type ProposalRow = {
  id: string | number;
  influencer_id: string;
  brand_name: string | null;
  brand_email: string | null;
  publish_deadline: string | null;
  status: string | null;
  delivery_submitted_at: string | null;
  delivery_confirmed_at: string | null;
  auto_completed_at: string | null;
  delivery_mode: string | null;
  deliverable_reminder_before_sent_at: string | null;
  deliverable_reminder_1d_after_sent_at: string | null;
  deliverable_reminder_5d_after_sent_at: string | null;
  brand_approve_reminder_sent_at: string | null;
  agreement_accepted_at: string | null;
};

const SELECT =
  "id, influencer_id, brand_name, brand_email, publish_deadline, status, delivery_submitted_at, delivery_confirmed_at, auto_completed_at, delivery_mode, deliverable_reminder_before_sent_at, deliverable_reminder_1d_after_sent_at, deliverable_reminder_5d_after_sent_at, brand_approve_reminder_sent_at, agreement_accepted_at";

type CampaignAppRow = {
  id: string;
  influencer_id: string;
  status: string | null;
  delivery_submitted_at: string | null;
  delivery_confirmed_at: string | null;
  auto_completed_at: string | null;
  delivery_mode: string | null;
  deliverable_status?: string | null;
  deliverable_reminder_before_sent_at: string | null;
  deliverable_reminder_1d_after_sent_at: string | null;
  deliverable_reminder_5d_after_sent_at: string | null;
  brand_approve_reminder_sent_at: string | null;
  reviewed_at: string | null;
  brand_campaigns?: {
    deadline?: string | null;
    opened_at?: string | null;
    created_at?: string | null;
    brands?: { brand_name?: string | null; contact_email?: string | null } | Array<{
      brand_name?: string | null;
      contact_email?: string | null;
    }> | null;
  } | Array<{
    deadline?: string | null;
    opened_at?: string | null;
    created_at?: string | null;
    brands?: { brand_name?: string | null; contact_email?: string | null } | null;
  }> | null;
};

const CAMPAIGN_SELECT =
  "id, influencer_id, status, delivery_submitted_at, delivery_confirmed_at, auto_completed_at, delivery_mode, deliverable_status, deliverable_reminder_before_sent_at, deliverable_reminder_1d_after_sent_at, deliverable_reminder_5d_after_sent_at, brand_approve_reminder_sent_at, reviewed_at, brand_campaigns ( brands ( brand_name, contact_email ) )";

function campaignBrandBits(row: CampaignAppRow): { brandName: string; brandEmail: string } {
  const raw = row.brand_campaigns;
  const campaign = Array.isArray(raw) ? raw[0] : raw;
  const brandRaw = campaign?.brands;
  const brand = Array.isArray(brandRaw) ? brandRaw[0] : brandRaw;
  return {
    brandName: brand?.brand_name || "Επιχείρηση",
    brandEmail: (brand?.contact_email || "").trim(),
  };
}

function dayMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

export async function runDeliverableReminders(
  admin: SupabaseClient,
  opts?: { nowMs?: number }
): Promise<{
  creatorScanned: number;
  creatorSent: number;
  brandScanned: number;
  brandSent: number;
  skipped: number;
  errors: string[];
  flags: { creator: boolean; brand: boolean };
}> {
  const nowMs = opts?.nowMs ?? Date.now();
  const creatorOn = isDeliverableRemindersEnabled();
  const brandOn = isBrandApproveRemindersEnabled();
  const errors: string[] = [];
  let creatorScanned = 0;
  let creatorSent = 0;
  let brandScanned = 0;
  let brandSent = 0;
  let skipped = 0;

  async function runCampaignCreatorReminders(): Promise<void> {
    const { data, error } = await admin
      .from("campaign_applications")
      .select(CAMPAIGN_SELECT)
      .eq("status", "accepted")
      .is("delivery_submitted_at", null)
      .is("delivery_confirmed_at", null)
      .is("auto_completed_at", null)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) {
      if (!/deliverable_reminder|schema cache|column|PGRST204|42703/i.test(error.message || "")) {
        errors.push(`campaign creator query: ${error.message}`);
      }
      return;
    }
    for (const row of (data || []) as CampaignAppRow[]) {
      creatorScanned += 1;
      if (isCollabEmailExcludedInfluencer(row.influencer_id)) {
        skipped += 1;
        continue;
      }
      if (isCampaignRealDeliveryComplete(row)) {
        skipped += 1;
        continue;
      }
      const dStatus = (row.deliverable_status || "").toLowerCase();
      if (dStatus === "submitted" || dStatus === "approved") {
        skipped += 1;
        continue;
      }
      const acceptedAt = row.reviewed_at;
      const acceptedMs = acceptedAt ? new Date(acceptedAt).getTime() : NaN;
      if (!Number.isFinite(acceptedMs)) {
        skipped += 1;
        continue;
      }
      if (isCampaignReminderBacklog(acceptedMs, { nowMs })) {
        skipped += 1;
        continue;
      }
      if (row.deliverable_reminder_before_sent_at) continue;
      const gentleDue = acceptedMs + dayMs(DELIVERABLE_REMINDER_GENTLE_DAYS);
      if (nowMs < gentleDue) continue;

      const wave = "gentle_7d" as const;
      const stampCol: keyof CampaignAppRow = "deliverable_reminder_before_sent_at";
      const { brandName } = campaignBrandBits(row);

      try {
        const prefs = await loadNotificationPreferences(admin, "influencer", row.influencer_id);
        if (!allowRemindersEmail(prefs)) {
          skipped += 1;
          continue;
        }
        const sentAt = new Date(nowMs).toISOString();
        const { data: claimed, error: claimErr } = await admin
          .from("campaign_applications")
          .update({ [stampCol]: sentAt })
          .eq("id", row.id)
          .eq("status", "accepted")
          .is(stampCol, null)
          .is("delivery_submitted_at", null)
          .select("id")
          .maybeSingle();
        if (claimErr || !claimed?.id) {
          skipped += 1;
          continue;
        }
        const contact = await influencerContact(row.influencer_id);
        await mailCreatorDeliverableReminder({
          to: contact.email,
          creatorName: contact.name,
          brandName,
          publishDeadline: null,
          wave,
          dashboardUrl: `${siteUrl()}/dashboard?tab=campaigns&focus=deliverable&application=${encodeURIComponent(String(row.id))}`,
        });
        creatorSent += 1;
      } catch (err) {
        errors.push(`campaign creator ${row.id}: ${err instanceof Error ? err.message : "fail"}`);
      }
    }
  }

  async function runCampaignBrandApproveReminders(): Promise<void> {
    const cutoff = new Date(nowMs - dayMs(BRAND_APPROVE_REMINDER_DAYS)).toISOString();
    const { data, error } = await admin
      .from("campaign_applications")
      .select(CAMPAIGN_SELECT)
      .eq("status", "accepted")
      .eq("deliverable_status", "submitted")
      .not("delivery_submitted_at", "is", null)
      .is("delivery_confirmed_at", null)
      .is("auto_completed_at", null)
      .is("brand_approve_reminder_sent_at", null)
      .lte("delivery_submitted_at", cutoff)
      .order("delivery_submitted_at", { ascending: true })
      .limit(200);
    if (error) {
      if (!/brand_approve_reminder|schema cache|column|PGRST204|42703/i.test(error.message || "")) {
        errors.push(`campaign brand query: ${error.message}`);
      }
      return;
    }
    for (const row of (data || []) as CampaignAppRow[]) {
      brandScanned += 1;
      if (isCollabEmailExcludedInfluencer(row.influencer_id)) {
        skipped += 1;
        continue;
      }
      if (isCampaignRealDeliveryComplete(row)) {
        skipped += 1;
        continue;
      }
      const submittedMs = row.delivery_submitted_at
        ? new Date(row.delivery_submitted_at).getTime()
        : NaN;
      if (!Number.isFinite(submittedMs) || isCampaignReminderBacklog(submittedMs, { nowMs })) {
        skipped += 1;
        continue;
      }
      const { brandName, brandEmail } = campaignBrandBits(row);
      if (!brandEmail) {
        skipped += 1;
        continue;
      }
      try {
        const brandId =
          (await admin.from("brands").select("id").ilike("contact_email", brandEmail).maybeSingle()).data
            ?.id || null;
        if (brandId) {
          const prefs = await loadNotificationPreferences(admin, "brand", String(brandId));
          if (!allowRemindersEmail(prefs)) {
            skipped += 1;
            continue;
          }
        }
        const sentAt = new Date(nowMs).toISOString();
        const { data: claimed, error: claimErr } = await admin
          .from("campaign_applications")
          .update({ brand_approve_reminder_sent_at: sentAt })
          .eq("id", row.id)
          .eq("status", "accepted")
          .eq("deliverable_status", "submitted")
          .is("brand_approve_reminder_sent_at", null)
          .is("delivery_confirmed_at", null)
          .select("id")
          .maybeSingle();
        if (claimErr || !claimed?.id) {
          skipped += 1;
          continue;
        }
        const contact = await influencerContact(row.influencer_id);
        await mailBrandApproveReminder({
          to: brandEmail,
          brandName,
          creatorName: contact.name,
          mode: row.delivery_mode || "link",
          dashboardUrl: `${siteUrl()}/brand/dashboard?tab=campaigns`,
        });
        brandSent += 1;
      } catch (err) {
        errors.push(`campaign brand ${row.id}: ${err instanceof Error ? err.message : "fail"}`);
      }
    }
  }

  if (creatorOn) {
    const { data, error } = await admin
      .from("proposals")
      .select(SELECT)
      .eq("status", "completed")
      .is("delivery_submitted_at", null)
      .is("delivery_confirmed_at", null)
      .is("auto_completed_at", null)
      .not("publish_deadline", "is", null)
      .order("publish_deadline", { ascending: true })
      .limit(200);
    if (error) {
      errors.push(`creator query: ${error.message}`);
    } else {
      for (const row of (data || []) as ProposalRow[]) {
        creatorScanned += 1;
        if (isCollabEmailExcludedInfluencer(row.influencer_id)) {
          skipped += 1;
          continue;
        }
        const deadlineEnd = publishDeadlineDueMs(row.publish_deadline);
        if (deadlineEnd == null) {
          skipped += 1;
          continue;
        }

        type Wave = "before" | "after_1" | "after_5";
        let wave: Wave | null = null;
        let stampCol: keyof ProposalRow | null = null;
        if (
          !row.deliverable_reminder_before_sent_at &&
          nowMs >= deadlineEnd - dayMs(DELIVERABLE_REMINDER_BEFORE_DAYS) &&
          nowMs < deadlineEnd
        ) {
          wave = "before";
          stampCol = "deliverable_reminder_before_sent_at";
        } else if (
          !row.deliverable_reminder_1d_after_sent_at &&
          nowMs >= deadlineEnd + dayMs(DELIVERABLE_REMINDER_AFTER_1_DAYS)
        ) {
          wave = "after_1";
          stampCol = "deliverable_reminder_1d_after_sent_at";
        } else if (
          !row.deliverable_reminder_5d_after_sent_at &&
          nowMs >= deadlineEnd + dayMs(DELIVERABLE_REMINDER_AFTER_5_DAYS)
        ) {
          wave = "after_5";
          stampCol = "deliverable_reminder_5d_after_sent_at";
        }
        if (!wave || !stampCol) continue;

        try {
          const prefs = await loadNotificationPreferences(admin, "influencer", row.influencer_id);
          if (!allowRemindersEmail(prefs)) {
            skipped += 1;
            continue;
          }
          const sentAt = new Date(nowMs).toISOString();
          const { data: claimed, error: claimErr } = await admin
            .from("proposals")
            .update({ [stampCol]: sentAt })
            .eq("id", row.id)
            .is(stampCol, null)
            .is("delivery_submitted_at", null)
            .select("id")
            .maybeSingle();
          if (claimErr || !claimed?.id) {
            skipped += 1;
            continue;
          }
          const contact = await influencerContact(row.influencer_id);
          await mailCreatorDeliverableReminder({
            to: contact.email,
            creatorName: contact.name,
            brandName: row.brand_name || "Επιχείρηση",
            publishDeadline: row.publish_deadline,
            wave,
            dashboardUrl: `${siteUrl()}/dashboard?tab=proposals&focus=deliverable&proposalId=${encodeURIComponent(String(row.id))}`,
          });
          creatorSent += 1;
        } catch (err) {
          errors.push(`creator ${row.id}: ${err instanceof Error ? err.message : "fail"}`);
        }
      }
    }
    await runCampaignCreatorReminders();

    const { data: noDeadline, error: noDlErr } = await admin
      .from("proposals")
      .select(SELECT)
      .eq("status", "completed")
      .is("publish_deadline", null)
      .not("agreement_accepted_at", "is", null)
      .is("delivery_submitted_at", null)
      .is("delivery_confirmed_at", null)
      .is("auto_completed_at", null)
      .is("deliverable_reminder_before_sent_at", null)
      .order("agreement_accepted_at", { ascending: true })
      .limit(200);
    if (noDlErr) {
      if (!/agreement_accepted_at|deliverable_reminder|schema cache|column|PGRST204|42703/i.test(noDlErr.message || "")) {
        errors.push(`creator no-deadline query: ${noDlErr.message}`);
      }
    } else {
      for (const row of (noDeadline || []) as ProposalRow[]) {
        creatorScanned += 1;
        if (isCollabEmailExcludedInfluencer(row.influencer_id)) {
          skipped += 1;
          continue;
        }
        const acceptedMs = row.agreement_accepted_at
          ? new Date(row.agreement_accepted_at).getTime()
          : NaN;
        if (!Number.isFinite(acceptedMs)) {
          skipped += 1;
          continue;
        }
        const gentleDue = acceptedMs + dayMs(DELIVERABLE_REMINDER_GENTLE_DAYS);
        if (nowMs < gentleDue) continue;

        try {
          const prefs = await loadNotificationPreferences(admin, "influencer", row.influencer_id);
          if (!allowRemindersEmail(prefs)) {
            skipped += 1;
            continue;
          }
          const sentAt = new Date(nowMs).toISOString();
          const { data: claimed, error: claimErr } = await admin
            .from("proposals")
            .update({ deliverable_reminder_before_sent_at: sentAt })
            .eq("id", row.id)
            .is("deliverable_reminder_before_sent_at", null)
            .is("delivery_submitted_at", null)
            .select("id")
            .maybeSingle();
          if (claimErr || !claimed?.id) {
            skipped += 1;
            continue;
          }
          const contact = await influencerContact(row.influencer_id);
          await mailCreatorDeliverableReminder({
            to: contact.email,
            creatorName: contact.name,
            brandName: row.brand_name || "Επιχείρηση",
            publishDeadline: null,
            wave: "gentle_7d",
            dashboardUrl: `${siteUrl()}/dashboard?tab=proposals&focus=deliverable&proposalId=${encodeURIComponent(String(row.id))}`,
          });
          creatorSent += 1;
        } catch (err) {
          errors.push(`creator gentle ${row.id}: ${err instanceof Error ? err.message : "fail"}`);
        }
      }
    }
  }

  if (brandOn) {
    const cutoff = new Date(nowMs - dayMs(BRAND_APPROVE_REMINDER_DAYS)).toISOString();
    const { data, error } = await admin
      .from("proposals")
      .select(SELECT)
      .eq("status", "completed")
      .not("delivery_submitted_at", "is", null)
      .is("delivery_confirmed_at", null)
      .is("auto_completed_at", null)
      .is("brand_approve_reminder_sent_at", null)
      .lte("delivery_submitted_at", cutoff)
      .order("delivery_submitted_at", { ascending: true })
      .limit(200);
    if (error) {
      errors.push(`brand query: ${error.message}`);
    } else {
      for (const row of (data || []) as ProposalRow[]) {
        brandScanned += 1;
        if (isCollabEmailExcludedInfluencer(row.influencer_id)) {
          skipped += 1;
          continue;
        }
        const brandEmail = (row.brand_email || "").trim();
        if (!brandEmail) {
          skipped += 1;
          continue;
        }
        try {
          const brandId =
            (await admin.from("brands").select("id").ilike("contact_email", brandEmail).maybeSingle())
              .data?.id || null;
          if (brandId) {
            const prefs = await loadNotificationPreferences(admin, "brand", String(brandId));
            if (!allowRemindersEmail(prefs)) {
              skipped += 1;
              continue;
            }
          }
          const sentAt = new Date(nowMs).toISOString();
          const { data: claimed, error: claimErr } = await admin
            .from("proposals")
            .update({ brand_approve_reminder_sent_at: sentAt })
            .eq("id", row.id)
            .is("brand_approve_reminder_sent_at", null)
            .is("delivery_confirmed_at", null)
            .select("id")
            .maybeSingle();
          if (claimErr || !claimed?.id) {
            skipped += 1;
            continue;
          }
          const contact = await influencerContact(row.influencer_id);
          await mailBrandApproveReminder({
            to: brandEmail,
            brandName: row.brand_name || "Επιχείρηση",
            creatorName: contact.name,
            mode: row.delivery_mode || "link",
            dashboardUrl: `${siteUrl()}/brand/dashboard?tab=proposals`,
          });
          brandSent += 1;
        } catch (err) {
          errors.push(`brand ${row.id}: ${err instanceof Error ? err.message : "fail"}`);
        }
      }
    }
    await runCampaignBrandApproveReminders();
  }

  return {
    creatorScanned,
    creatorSent,
    brandScanned,
    brandSent,
    skipped,
    errors,
    flags: { creator: creatorOn, brand: brandOn },
  };
}
