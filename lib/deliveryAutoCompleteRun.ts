/**
 * 7-day safety net (DELIVERY_AUTO_COMPLETE_ENABLED):
 * - Link mode (published link submitted): set auto_completed_at (real completion).
 * - Event mode: do NOT auto-complete; enqueue admin digest «Εκκρεμεί επιβεβαίωση»
 *   once (event_admin_pending_notified_at) so admin can complete manually.
 * - No submission → never auto-complete (abandoned deals stay «Σε εξέλιξη»).
 * Completion emails behind DELIVERY_AUTO_COMPLETE_EMAIL_ENABLED (link auto only).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueAdminDigestItem } from "@/lib/adminDailyDigest";
import { isCollabEmailExcludedInfluencer } from "@/lib/collabEmailExclusion";
import {
  DELIVERY_AUTO_COMPLETE_DAYS,
  isDeliveryAutoCompleteEmailEnabled,
  isDeliveryAutoCompleteEnabled,
} from "@/lib/deliveryFlags";
import { notifyRealCollaborationComplete } from "@/lib/notifyCollaborationComplete";
import { influencerContact } from "@/lib/proposalAccess";

type ProposalRow = {
  id: string | number;
  influencer_id: string;
  brand_name: string | null;
  brand_email: string | null;
  delivery_submitted_at: string | null;
  delivery_mode: string | null;
};

type CampaignRow = {
  id: string;
  influencer_id: string;
  delivery_submitted_at: string | null;
  delivery_mode: string | null;
  deliverable_status: string | null;
  brand_campaigns:
    | {
        title?: string;
        brands?: { brand_name?: string; contact_email?: string } | { brand_name?: string; contact_email?: string }[] | null;
      }
    | {
        title?: string;
        brands?: { brand_name?: string; contact_email?: string } | { brand_name?: string; contact_email?: string }[] | null;
      }[]
    | null;
};

function brandBits(row: CampaignRow): { brandName: string; brandEmail: string } {
  const raw = row.brand_campaigns;
  const campaign = Array.isArray(raw) ? raw[0] : raw;
  const brandRow = Array.isArray(campaign?.brands) ? campaign?.brands[0] : campaign?.brands;
  return {
    brandName: brandRow?.brand_name || "Επιχείρηση",
    brandEmail: (brandRow?.contact_email || "").trim(),
  };
}

export async function runDeliveryAutoComplete(
  admin: SupabaseClient,
  opts?: { nowMs?: number; limit?: number }
): Promise<{
  proposals: number;
  campaigns: number;
  eventPendingNotified: number;
  emailed: number;
  skipped: number;
  errors: string[];
  enabled: boolean;
}> {
  const enabled = isDeliveryAutoCompleteEnabled();
  if (!enabled) {
    return {
      proposals: 0,
      campaigns: 0,
      eventPendingNotified: 0,
      emailed: 0,
      skipped: 0,
      errors: [],
      enabled: false,
    };
  }

  const nowMs = opts?.nowMs ?? Date.now();
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
  const cutoff = new Date(nowMs - DELIVERY_AUTO_COMPLETE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const emailOn = isDeliveryAutoCompleteEmailEnabled();
  const errors: string[] = [];
  let proposals = 0;
  let campaigns = 0;
  let eventPendingNotified = 0;
  let emailed = 0;
  let skipped = 0;

  // ── Link mode: auto-complete ─────────────────────────────────────────────
  {
    const { data, error } = await admin
      .from("proposals")
      .select("id, influencer_id, brand_name, brand_email, delivery_submitted_at, delivery_mode")
      .eq("status", "completed")
      .eq("delivery_mode", "link")
      .not("delivery_submitted_at", "is", null)
      .is("delivery_confirmed_at", null)
      .is("auto_completed_at", null)
      .lte("delivery_submitted_at", cutoff)
      .order("delivery_submitted_at", { ascending: true })
      .limit(200);
    if (error) {
      errors.push(`proposals: ${error.message}`);
    } else {
      for (const row of (data || []) as ProposalRow[]) {
        if (proposals >= limit) break;
        if (isCollabEmailExcludedInfluencer(row.influencer_id)) {
          skipped += 1;
          continue;
        }
        const at = new Date(nowMs).toISOString();
        const { data: claimed, error: claimErr } = await admin
          .from("proposals")
          .update({ auto_completed_at: at })
          .eq("id", row.id)
          .eq("delivery_mode", "link")
          .is("auto_completed_at", null)
          .is("delivery_confirmed_at", null)
          .select("id")
          .maybeSingle();
        if (claimErr || !claimed?.id) {
          skipped += 1;
          continue;
        }
        proposals += 1;
        if (emailOn) {
          try {
            const contact = await influencerContact(row.influencer_id);
            const result = await notifyRealCollaborationComplete(admin, {
              source: "proposal",
              id: row.id,
              influencerId: row.influencer_id,
              brandName: row.brand_name || "Επιχείρηση",
              brandEmail: row.brand_email,
              creatorName: contact.name,
              creatorEmail: contact.email,
              mode: "auto",
              deliveryMode: "link",
            });
            if (result.emailed > 0) emailed += 1;
          } catch (err) {
            errors.push(`proposal mail ${row.id}: ${err instanceof Error ? err.message : "fail"}`);
          }
        }
      }
    }
  }

  {
    const { data, error } = await admin
      .from("campaign_applications")
      .select(
        "id, influencer_id, delivery_submitted_at, delivery_mode, deliverable_status, brand_campaigns ( title, brands ( brand_name, contact_email ) )"
      )
      .eq("delivery_mode", "link")
      .not("delivery_submitted_at", "is", null)
      .is("delivery_confirmed_at", null)
      .is("auto_completed_at", null)
      .eq("deliverable_status", "submitted")
      .lte("delivery_submitted_at", cutoff)
      .order("delivery_submitted_at", { ascending: true })
      .limit(200);
    if (error) {
      if (!/delivery_submitted|auto_completed|delivery_mode|schema cache|42703|PGRST204/i.test(error.message || "")) {
        errors.push(`campaigns: ${error.message}`);
      }
    } else {
      for (const row of (data || []) as CampaignRow[]) {
        if (campaigns >= limit) break;
        if (isCollabEmailExcludedInfluencer(row.influencer_id)) {
          skipped += 1;
          continue;
        }
        const at = new Date(nowMs).toISOString();
        const { data: claimed, error: claimErr } = await admin
          .from("campaign_applications")
          .update({
            auto_completed_at: at,
            delivery_confirmed_at: at,
            deliverable_status: "approved",
            reviewed_at: at,
          })
          .eq("id", row.id)
          .eq("delivery_mode", "link")
          .is("auto_completed_at", null)
          .is("delivery_confirmed_at", null)
          .select("id")
          .maybeSingle();
        if (claimErr || !claimed?.id) {
          skipped += 1;
          continue;
        }
        campaigns += 1;
        if (emailOn) {
          try {
            const { brandName, brandEmail } = brandBits(row);
            const contact = await influencerContact(row.influencer_id);
            const result = await notifyRealCollaborationComplete(admin, {
              source: "campaign",
              id: row.id,
              influencerId: row.influencer_id,
              brandName,
              brandEmail,
              creatorName: contact.name,
              creatorEmail: contact.email,
              mode: "auto",
              deliveryMode: "link",
            });
            if (result.emailed > 0) emailed += 1;
          } catch (err) {
            errors.push(`campaign mail ${row.id}: ${err instanceof Error ? err.message : "fail"}`);
          }
        }
      }
    }
  }

  // ── Event mode: notify admin (no auto-complete) ──────────────────────────
  const notifyLimit = Math.min(limit, 40);

  {
    const { data, error } = await admin
      .from("proposals")
      .select("id, influencer_id, brand_name, brand_email, delivery_submitted_at, delivery_mode")
      .eq("status", "completed")
      .eq("delivery_mode", "event")
      .not("delivery_submitted_at", "is", null)
      .is("delivery_confirmed_at", null)
      .is("auto_completed_at", null)
      .is("event_admin_pending_notified_at", null)
      .lte("delivery_submitted_at", cutoff)
      .order("delivery_submitted_at", { ascending: true })
      .limit(200);
    if (error) {
      if (!/event_admin_pending|delivery_mode|schema cache|42703|PGRST204/i.test(error.message || "")) {
        errors.push(`proposal event pending: ${error.message}`);
      }
    } else {
      for (const row of (data || []) as ProposalRow[]) {
        if (eventPendingNotified >= notifyLimit) break;
        const at = new Date(nowMs).toISOString();
        const { data: claimed, error: claimErr } = await admin
          .from("proposals")
          .update({ event_admin_pending_notified_at: at })
          .eq("id", row.id)
          .eq("delivery_mode", "event")
          .is("event_admin_pending_notified_at", null)
          .is("delivery_confirmed_at", null)
          .is("auto_completed_at", null)
          .select("id")
          .maybeSingle();
        if (claimErr || !claimed?.id) {
          skipped += 1;
          continue;
        }
        try {
          const contact = await influencerContact(row.influencer_id);
          await enqueueAdminDigestItem(admin, "event_confirm_pending", {
            brandName: row.brand_name || "Επιχείρηση",
            creatorName: contact.name,
            source: "proposal",
            id: String(row.id),
            deliveryMode: "event",
          });
          eventPendingNotified += 1;
        } catch (err) {
          errors.push(`proposal event digest ${row.id}: ${err instanceof Error ? err.message : "fail"}`);
        }
      }
    }
  }

  {
    const { data, error } = await admin
      .from("campaign_applications")
      .select(
        "id, influencer_id, delivery_submitted_at, delivery_mode, deliverable_status, brand_campaigns ( title, brands ( brand_name, contact_email ) )"
      )
      .eq("delivery_mode", "event")
      .not("delivery_submitted_at", "is", null)
      .is("delivery_confirmed_at", null)
      .is("auto_completed_at", null)
      .is("event_admin_pending_notified_at", null)
      .in("deliverable_status", ["submitted", "changes_requested"])
      .lte("delivery_submitted_at", cutoff)
      .order("delivery_submitted_at", { ascending: true })
      .limit(200);
    if (error) {
      if (!/event_admin_pending|delivery_mode|schema cache|42703|PGRST204/i.test(error.message || "")) {
        errors.push(`campaign event pending: ${error.message}`);
      }
    } else {
      for (const row of (data || []) as CampaignRow[]) {
        if (eventPendingNotified >= notifyLimit) break;
        const at = new Date(nowMs).toISOString();
        const { data: claimed, error: claimErr } = await admin
          .from("campaign_applications")
          .update({ event_admin_pending_notified_at: at })
          .eq("id", row.id)
          .eq("delivery_mode", "event")
          .is("event_admin_pending_notified_at", null)
          .is("delivery_confirmed_at", null)
          .is("auto_completed_at", null)
          .select("id")
          .maybeSingle();
        if (claimErr || !claimed?.id) {
          skipped += 1;
          continue;
        }
        try {
          const { brandName } = brandBits(row);
          const contact = await influencerContact(row.influencer_id);
          await enqueueAdminDigestItem(admin, "event_confirm_pending", {
            brandName,
            creatorName: contact.name,
            source: "campaign",
            id: String(row.id),
            deliveryMode: "event",
          });
          eventPendingNotified += 1;
        } catch (err) {
          errors.push(`campaign event digest ${row.id}: ${err instanceof Error ? err.message : "fail"}`);
        }
      }
    }
  }

  return {
    proposals,
    campaigns,
    eventPendingNotified,
    emailed,
    skipped,
    errors,
    enabled,
  };
}
