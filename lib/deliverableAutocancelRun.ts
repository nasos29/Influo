/**
 * Day 10 warning + auto-cancel 3 Athens days after warning.
 * Gated by DELIVERABLE_AUTOCANCEL_ENABLED / DELIVERABLE_AUTOCANCEL_SINCE.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isCollabEmailExcludedInfluencer } from "@/lib/collabEmailExclusion";
import { stampDeliverableWarningBoth, systemAutoCancelRows } from "@/lib/deliverableAutocancelActions";
import {
  hasSubmittedDeliverable,
  isActiveDealForAutocancel,
  isAutomaticWarningEligible,
  isAutocancelDue,
  passesSinceCutoff,
  type AutocancelRow,
  type CollaboratorSource,
} from "@/lib/deliverableAutocancelEligibility";
import {
  deliverableAutocancelSinceMs,
  isDeliverableAutocancelEmailsEnabled,
  isDeliverableAutocancelEnabled,
} from "@/lib/deliveryFlags";
import {
  mailDeliverableAutocancelNotice,
  mailDeliverableWarningCreator,
  siteUrl,
} from "@/lib/deliveryMail";
import { allowRemindersEmail, loadNotificationPreferences } from "@/lib/notificationPreferences";
import { influencerContact } from "@/lib/proposalAccess";

const PROPOSAL_SELECT =
  "id, influencer_id, brand_name, brand_email, status, agreement_accepted_at, delivery_submitted_at, delivery_confirmed_at, auto_completed_at, published_post_url, deliverable_status, showcase_admin_hidden, deliverable_warning_sent_at, auto_cancelled_at, restored_at";

const CAMPAIGN_SELECT =
  "id, influencer_id, status, reviewed_at, delivery_submitted_at, delivery_confirmed_at, auto_completed_at, deliverable_url, deliverable_status, showcase_admin_hidden, deliverable_warning_sent_at, auto_cancelled_at, restored_at, brand_campaigns ( brands ( brand_name, contact_email ) )";

function mapProposal(row: Record<string, unknown>): AutocancelRow {
  return {
    source: "proposal",
    id: String(row.id),
    influencer_id: String(row.influencer_id),
    brand_name: String(row.brand_name || "").trim(),
    brand_email: typeof row.brand_email === "string" ? row.brand_email : null,
    status: String(row.status || ""),
    agreement_accepted_at: typeof row.agreement_accepted_at === "string" ? row.agreement_accepted_at : null,
    delivery_submitted_at: typeof row.delivery_submitted_at === "string" ? row.delivery_submitted_at : null,
    delivery_confirmed_at: typeof row.delivery_confirmed_at === "string" ? row.delivery_confirmed_at : null,
    auto_completed_at: typeof row.auto_completed_at === "string" ? row.auto_completed_at : null,
    published_post_url: typeof row.published_post_url === "string" ? row.published_post_url : null,
    deliverable_status: typeof row.deliverable_status === "string" ? row.deliverable_status : null,
    showcase_admin_hidden: !!row.showcase_admin_hidden,
    deliverable_warning_sent_at:
      typeof row.deliverable_warning_sent_at === "string" ? row.deliverable_warning_sent_at : null,
    auto_cancelled_at: typeof row.auto_cancelled_at === "string" ? row.auto_cancelled_at : null,
    restored_at: typeof row.restored_at === "string" ? row.restored_at : null,
  };
}

function mapCampaign(row: Record<string, unknown>): AutocancelRow {
  const raw = row.brand_campaigns;
  const campaign = Array.isArray(raw) ? raw[0] : raw;
  const brandsRaw = (campaign as { brands?: unknown })?.brands;
  const brand = Array.isArray(brandsRaw) ? brandsRaw[0] : brandsRaw;
  const brandName = String((brand as { brand_name?: string })?.brand_name || "").trim();
  const brandEmail = String((brand as { contact_email?: string })?.contact_email || "").trim();
  return {
    source: "campaign",
    id: String(row.id),
    influencer_id: String(row.influencer_id),
    brand_name: brandName,
    brand_email: brandEmail || null,
    status: String(row.status || ""),
    reviewed_at: typeof row.reviewed_at === "string" ? row.reviewed_at : null,
    delivery_submitted_at: typeof row.delivery_submitted_at === "string" ? row.delivery_submitted_at : null,
    delivery_confirmed_at: typeof row.delivery_confirmed_at === "string" ? row.delivery_confirmed_at : null,
    auto_completed_at: typeof row.auto_completed_at === "string" ? row.auto_completed_at : null,
    deliverable_url: typeof row.deliverable_url === "string" ? row.deliverable_url : null,
    deliverable_status: typeof row.deliverable_status === "string" ? row.deliverable_status : null,
    showcase_admin_hidden: !!row.showcase_admin_hidden,
    deliverable_warning_sent_at:
      typeof row.deliverable_warning_sent_at === "string" ? row.deliverable_warning_sent_at : null,
    auto_cancelled_at: typeof row.auto_cancelled_at === "string" ? row.auto_cancelled_at : null,
    restored_at: typeof row.restored_at === "string" ? row.restored_at : null,
  };
}

function dashboardDeliverableUrl(row: AutocancelRow): string {
  if (row.source === "campaign") {
    return `${siteUrl()}/dashboard?tab=campaigns&focus=deliverable&application=${encodeURIComponent(row.id)}`;
  }
  return `${siteUrl()}/dashboard?tab=proposals&focus=deliverable&proposalId=${encodeURIComponent(row.id)}`;
}

function dashboardCancelUrl(row: AutocancelRow): string {
  if (row.source === "campaign") {
    return `${siteUrl()}/dashboard?tab=campaigns&focus=cancel&application=${encodeURIComponent(row.id)}`;
  }
  return `${siteUrl()}/dashboard?tab=proposals&focus=cancel&proposalId=${encodeURIComponent(row.id)}`;
}

function pairDedupeKey(row: AutocancelRow): string {
  return `${row.influencer_id}::${row.brand_name.toLowerCase()}`;
}

export async function runDeliverableAutocancel(
  admin: SupabaseClient,
  opts?: { nowMs?: number }
): Promise<{
  enabled: boolean;
  warningsScanned: number;
  warningsSent: number;
  cancelScanned: number;
  cancelled: number;
  skipped: number;
  errors: string[];
}> {
  const enabled = isDeliverableAutocancelEnabled();
  if (!enabled) {
    return {
      enabled: false,
      warningsScanned: 0,
      warningsSent: 0,
      cancelScanned: 0,
      cancelled: 0,
      skipped: 0,
      errors: [],
    };
  }

  const nowMs = opts?.nowMs ?? Date.now();
  const sinceMs = deliverableAutocancelSinceMs();
  const emailsOn = isDeliverableAutocancelEmailsEnabled();
  const errors: string[] = [];
  let warningsScanned = 0;
  let warningsSent = 0;
  let cancelScanned = 0;
  let cancelled = 0;
  let skipped = 0;
  const warnedPairs = new Set<string>();

  async function loadRows(): Promise<AutocancelRow[]> {
    const rows: AutocancelRow[] = [];
    const propRes = await admin
      .from("proposals")
      .select(PROPOSAL_SELECT)
      .in("status", ["completed", "accepted"])
      .is("auto_cancelled_at", null)
      .limit(200);
    if (propRes.error && !/deliverable_warning|restored_at|auto_cancelled|schema|PGRST204|42703/i.test(propRes.error.message || "")) {
      errors.push(`proposals: ${propRes.error.message}`);
    } else {
      for (const row of propRes.data || []) rows.push(mapProposal(row as Record<string, unknown>));
    }

    const campRes = await admin
      .from("campaign_applications")
      .select(CAMPAIGN_SELECT)
      .eq("status", "accepted")
      .is("auto_cancelled_at", null)
      .limit(200);
    if (campRes.error && !/deliverable_warning|restored_at|auto_cancelled|schema|PGRST204|42703/i.test(campRes.error.message || "")) {
      errors.push(`campaigns: ${campRes.error.message}`);
    } else {
      for (const row of campRes.data || []) rows.push(mapCampaign(row as Record<string, unknown>));
    }

    const cancelProp = await admin
      .from("proposals")
      .select(PROPOSAL_SELECT)
      .in("status", ["completed", "accepted"])
      .not("deliverable_warning_sent_at", "is", null)
      .is("auto_cancelled_at", null)
      .limit(200);
    if (!cancelProp.error) {
      for (const row of cancelProp.data || []) rows.push(mapProposal(row as Record<string, unknown>));
    }

    const cancelCamp = await admin
      .from("campaign_applications")
      .select(CAMPAIGN_SELECT)
      .eq("status", "accepted")
      .not("deliverable_warning_sent_at", "is", null)
      .is("auto_cancelled_at", null)
      .limit(200);
    if (!cancelCamp.error) {
      for (const row of cancelCamp.data || []) rows.push(mapCampaign(row as Record<string, unknown>));
    }

    const seen = new Set<string>();
    return rows.filter((r) => {
      const k = `${r.source}:${r.id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return isActiveDealForAutocancel(r);
    });
  }

  const allRows = await loadRows();

  for (const row of allRows) {
    if (!isAutomaticWarningEligible(row, nowMs, sinceMs)) continue;
    if (!passesSinceCutoff(row)) continue;
    warningsScanned += 1;
    const dedupe = pairDedupeKey(row);
    if (warnedPairs.has(dedupe)) continue;
    if (isCollabEmailExcludedInfluencer(row.influencer_id)) {
      skipped += 1;
      continue;
    }

    try {
      const sentAt = new Date(nowMs).toISOString();
      const { data: claimed, error: claimErr } = await admin
        .from(row.source === "campaign" ? "campaign_applications" : "proposals")
        .update({ deliverable_warning_sent_at: sentAt })
        .eq("id", row.id)
        .is("deliverable_warning_sent_at", null)
        .select("id")
        .maybeSingle();
      if (claimErr || !claimed?.id) {
        skipped += 1;
        continue;
      }
      await stampDeliverableWarningBoth(admin, { ...row, deliverable_warning_sent_at: sentAt }, sentAt);
      warnedPairs.add(dedupe);

      const prefs = await loadNotificationPreferences(admin, "influencer", row.influencer_id);
      if (!allowRemindersEmail(prefs)) {
        skipped += 1;
        continue;
      }
      if (emailsOn) {
        const contact = await influencerContact(row.influencer_id);
        await mailDeliverableWarningCreator({
          to: contact.email,
          creatorName: contact.name,
          brandName: row.brand_name || "Επιχείρηση",
          uploadUrl: dashboardDeliverableUrl(row),
          cancelUrl: dashboardCancelUrl(row),
        });
      }
      warningsSent += 1;
    } catch (err) {
      errors.push(`warn ${row.source} ${row.id}: ${err instanceof Error ? err.message : "fail"}`);
    }
  }

  for (const row of allRows) {
    if (!row.deliverable_warning_sent_at) continue;
    if (hasSubmittedDeliverable(row)) continue;
    if (!isAutocancelDue(row, nowMs)) continue;
    cancelScanned += 1;

    try {
      const cancelledAt = new Date(nowMs).toISOString();
      const ids = await systemAutoCancelRows(admin, row, cancelledAt);
      if (!ids.length) {
        skipped += 1;
        continue;
      }
      cancelled += ids.length;

      if (emailsOn) {
        const contact = await influencerContact(row.influencer_id);
        const brandEmail = row.brand_email;
        await mailDeliverableAutocancelNotice({
          to: contact.email,
          party: "creator",
          creatorName: contact.name,
          brandName: row.brand_name || "Επιχείρηση",
          dashboardUrl: `${siteUrl()}/dashboard`,
        });
        if (brandEmail) {
          await mailDeliverableAutocancelNotice({
            to: brandEmail,
            party: "brand",
            creatorName: contact.name,
            brandName: row.brand_name || "Επιχείρηση",
            dashboardUrl: `${siteUrl()}/brand/dashboard`,
          });
        }
      }
    } catch (err) {
      errors.push(`cancel ${row.source} ${row.id}: ${err instanceof Error ? err.message : "fail"}`);
    }
  }

  return {
    enabled: true,
    warningsScanned,
    warningsSent,
    cancelScanned,
    cancelled,
    skipped,
    errors,
  };
}

/** Admin manual warning (ignores since cutoff). */
export async function sendManualDeliverableWarning(
  admin: SupabaseClient,
  source: CollaboratorSource,
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const table = source === "campaign" ? "campaign_applications" : "proposals";
  const select = source === "campaign" ? CAMPAIGN_SELECT : PROPOSAL_SELECT;
  const { data, error } = await admin.from(table).select(select).eq("id", id).maybeSingle();
  if (error || !data) return { ok: false, error: "not_found" };
  const row = source === "campaign" ? mapCampaign(data as Record<string, unknown>) : mapProposal(data as Record<string, unknown>);
  if (!isActiveDealForAutocancel(row)) {
    return { ok: false, error: "not_eligible" };
  }
  if (hasSubmittedDeliverable(row)) return { ok: false, error: "has_deliverable" };
  if (row.showcase_admin_hidden) return { ok: false, error: "hidden" };

  const sentAt = new Date().toISOString();
  const { data: claimed, error: claimErr } = await admin
    .from(table)
    .update({ deliverable_warning_sent_at: sentAt })
    .eq("id", id)
    .is("deliverable_warning_sent_at", null)
    .select("id")
    .maybeSingle();
  if (claimErr || !claimed?.id) return { ok: false, error: "already_warned" };

  await stampDeliverableWarningBoth(admin, { ...row, deliverable_warning_sent_at: sentAt }, sentAt);

  if (isDeliverableAutocancelEmailsEnabled() && !isCollabEmailExcludedInfluencer(row.influencer_id)) {
    const prefs = await loadNotificationPreferences(admin, "influencer", row.influencer_id);
    if (allowRemindersEmail(prefs)) {
      const contact = await influencerContact(row.influencer_id);
      await mailDeliverableWarningCreator({
        to: contact.email,
        creatorName: contact.name,
        brandName: row.brand_name || "Επιχείρηση",
        uploadUrl: dashboardDeliverableUrl(row),
        cancelUrl: dashboardCancelUrl(row),
      });
    }
  }

  return { ok: true };
}