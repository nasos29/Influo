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
  isBrandApproveRemindersEnabled,
  isDeliverableRemindersEnabled,
} from "@/lib/deliveryFlags";
import { mailBrandApproveReminder, mailCreatorDeliverableReminder, siteUrl } from "@/lib/deliveryMail";
import {
  allowRemindersEmail,
  loadNotificationPreferences,
} from "@/lib/notificationPreferences";
import { influencerContact } from "@/lib/proposalAccess";
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
};

const SELECT =
  "id, influencer_id, brand_name, brand_email, publish_deadline, status, delivery_submitted_at, delivery_confirmed_at, auto_completed_at, delivery_mode, deliverable_reminder_before_sent_at, deliverable_reminder_1d_after_sent_at, deliverable_reminder_5d_after_sent_at, brand_approve_reminder_sent_at";

function dayMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

export async function runDeliverableReminders(
  admin: SupabaseClient,
  opts?: { nowMs?: number; limit?: number }
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
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
  const creatorOn = isDeliverableRemindersEnabled();
  const brandOn = isBrandApproveRemindersEnabled();
  const errors: string[] = [];
  let creatorScanned = 0;
  let creatorSent = 0;
  let brandScanned = 0;
  let brandSent = 0;
  let skipped = 0;

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
        if (creatorSent >= limit) break;
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
            dashboardUrl: `${siteUrl()}/dashboard?tab=proposals&deliverable=1&proposalId=${encodeURIComponent(String(row.id))}`,
          });
          creatorSent += 1;
        } catch (err) {
          errors.push(`creator ${row.id}: ${err instanceof Error ? err.message : "fail"}`);
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
        if (brandSent >= limit) break;
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
