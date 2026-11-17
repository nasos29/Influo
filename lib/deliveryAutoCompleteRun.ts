/**
 * Safety net: if creator submitted and brand did not confirm within 7 days,
 * set auto_completed_at (real completion). Emails behind DELIVERY_AUTO_COMPLETE_EMAIL_ENABLED.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isCollabEmailExcludedInfluencer } from "@/lib/collabEmailExclusion";
import {
  DELIVERY_AUTO_COMPLETE_DAYS,
  isDeliveryAutoCompleteEmailEnabled,
  isDeliveryAutoCompleteEnabled,
} from "@/lib/deliveryFlags";
import { mailDeliveryAutoCompleted, siteUrl } from "@/lib/deliveryMail";
import { influencerContact } from "@/lib/proposalAccess";

type ProposalRow = {
  id: string | number;
  influencer_id: string;
  brand_name: string | null;
  brand_email: string | null;
  delivery_submitted_at: string | null;
};

type CampaignRow = {
  id: string;
  influencer_id: string;
  delivery_submitted_at: string | null;
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

export async function runDeliveryAutoComplete(
  admin: SupabaseClient,
  opts?: { nowMs?: number; limit?: number }
): Promise<{
  proposals: number;
  campaigns: number;
  emailed: number;
  skipped: number;
  errors: string[];
  enabled: boolean;
}> {
  const enabled = isDeliveryAutoCompleteEnabled();
  if (!enabled) {
    return { proposals: 0, campaigns: 0, emailed: 0, skipped: 0, errors: [], enabled: false };
  }

  const nowMs = opts?.nowMs ?? Date.now();
  const limit = Math.min(Math.max(opts?.limit ?? 40, 1), 100);
  const cutoff = new Date(nowMs - DELIVERY_AUTO_COMPLETE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const emailOn = isDeliveryAutoCompleteEmailEnabled();
  const errors: string[] = [];
  let proposals = 0;
  let campaigns = 0;
  let emailed = 0;
  let skipped = 0;

  {
    const { data, error } = await admin
      .from("proposals")
      .select("id, influencer_id, brand_name, brand_email, delivery_submitted_at")
      .eq("status", "completed")
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
            const brandEmail = (row.brand_email || "").trim();
            await Promise.all([
              mailDeliveryAutoCompleted({
                to: contact.email,
                party: "creator",
                creatorName: contact.name,
                brandName: row.brand_name || "Επιχείρηση",
                dashboardUrl: `${siteUrl()}/dashboard?tab=proposals`,
              }),
              brandEmail
                ? mailDeliveryAutoCompleted({
                    to: brandEmail,
                    party: "brand",
                    creatorName: contact.name,
                    brandName: row.brand_name || "Επιχείρηση",
                    dashboardUrl: `${siteUrl()}/brand/dashboard?tab=proposals`,
                  })
                : Promise.resolve(),
            ]);
            emailed += 1;
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
        "id, influencer_id, delivery_submitted_at, deliverable_status, brand_campaigns ( title, brands ( brand_name, contact_email ) )"
      )
      .not("delivery_submitted_at", "is", null)
      .is("delivery_confirmed_at", null)
      .is("auto_completed_at", null)
      .in("deliverable_status", ["submitted", "changes_requested"])
      .lte("delivery_submitted_at", cutoff)
      .order("delivery_submitted_at", { ascending: true })
      .limit(200);
    if (error) {
      // Column may be missing until migration applied.
      if (!/delivery_submitted|auto_completed|schema cache|42703|PGRST204/i.test(error.message || "")) {
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
            const raw = row.brand_campaigns;
            const campaign = Array.isArray(raw) ? raw[0] : raw;
            const brandRow = Array.isArray(campaign?.brands) ? campaign?.brands[0] : campaign?.brands;
            const brandEmail = (brandRow?.contact_email || "").trim();
            const brandName = brandRow?.brand_name || "Επιχείρηση";
            const contact = await influencerContact(row.influencer_id);
            await Promise.all([
              mailDeliveryAutoCompleted({
                to: contact.email,
                party: "creator",
                creatorName: contact.name,
                brandName,
                dashboardUrl: `${siteUrl()}/dashboard?tab=campaigns`,
              }),
              brandEmail
                ? mailDeliveryAutoCompleted({
                    to: brandEmail,
                    party: "brand",
                    creatorName: contact.name,
                    brandName,
                    dashboardUrl: `${siteUrl()}/brand/dashboard?tab=campaigns`,
                  })
                : Promise.resolve(),
            ]);
            emailed += 1;
          } catch (err) {
            errors.push(`campaign mail ${row.id}: ${err instanceof Error ? err.message : "fail"}`);
          }
        }
      }
    }
  }

  return { proposals, campaigns, emailed, skipped, errors, enabled };
}
