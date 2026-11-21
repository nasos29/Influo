import type { SupabaseClient } from "@supabase/supabase-js";
import { isCampaignRealDeliveryComplete } from "@/lib/campaignDealCompletion";
import { DELIVERABLE_AUTOCANCEL_REASON } from "@/lib/deliveryFlags";
import {
  hasSubmittedDeliverable,
  normalizeBrandKey,
  pairKey,
  type AutocancelRow,
  type CollaboratorSource,
} from "@/lib/deliverableAutocancelEligibility";
import { isRealDeliveryComplete } from "@/lib/deliveryCompletion";
import { revalidatePublicProfileById } from "@/lib/revalidatePublicProfile";

export type SystemCancelledBy = "system";

const PROPOSAL_CANCEL_SELECT =
  "id, influencer_id, brand_name, brand_email, status, agreement_accepted_at, delivery_submitted_at, delivery_confirmed_at, auto_completed_at, published_post_url, deliverable_status, showcase_admin_hidden, deliverable_warning_sent_at, auto_cancelled_at, restored_at";

const CAMPAIGN_CANCEL_SELECT =
  "id, influencer_id, status, reviewed_at, delivery_submitted_at, delivery_confirmed_at, auto_completed_at, deliverable_url, deliverable_status, showcase_admin_hidden, deliverable_warning_sent_at, auto_cancelled_at, restored_at, brand_campaigns ( brands ( brand_name, contact_email ) )";

function campaignBrandName(row: Record<string, unknown>): string {
  const raw = row.brand_campaigns;
  const campaign = Array.isArray(raw) ? raw[0] : raw;
  const brandsRaw = (campaign as { brands?: unknown })?.brands;
  const brand = Array.isArray(brandsRaw) ? brandsRaw[0] : brandsRaw;
  return String((brand as { brand_name?: string })?.brand_name || "").trim();
}

function campaignBrandEmail(row: Record<string, unknown>): string {
  const raw = row.brand_campaigns;
  const campaign = Array.isArray(raw) ? raw[0] : raw;
  const brandsRaw = (campaign as { brands?: unknown })?.brands;
  const brand = Array.isArray(brandsRaw) ? brandsRaw[0] : brandsRaw;
  return String((brand as { contact_email?: string })?.contact_email || "").trim();
}

export async function findSiblingDeals(
  admin: SupabaseClient,
  source: CollaboratorSource,
  influencerId: string,
  brandName: string,
  exclude?: { source: CollaboratorSource; id: string }
): Promise<AutocancelRow[]> {
  const key = pairKey(influencerId, brandName);
  const out: AutocancelRow[] = [];

  const { data: proposals } = await admin
    .from("proposals")
    .select(PROPOSAL_CANCEL_SELECT)
    .eq("influencer_id", influencerId)
    .in("status", ["completed", "accepted", "cancelled"])
    .limit(30);

  for (const row of proposals || []) {
    const name = String(row.brand_name || "").trim();
    if (pairKey(influencerId, name) !== key) continue;
    if (exclude?.source === "proposal" && String(row.id) === exclude.id) continue;
    out.push({
      source: "proposal",
      id: String(row.id),
      influencer_id: influencerId,
      brand_name: name,
      brand_email: row.brand_email,
      status: row.status,
      showcase_admin_hidden: row.showcase_admin_hidden,
      deliverable_warning_sent_at: row.deliverable_warning_sent_at,
      auto_cancelled_at: row.auto_cancelled_at,
      restored_at: row.restored_at,
      agreement_accepted_at: row.agreement_accepted_at,
      delivery_submitted_at: row.delivery_submitted_at,
      delivery_confirmed_at: row.delivery_confirmed_at,
      auto_completed_at: row.auto_completed_at,
      published_post_url: row.published_post_url,
      deliverable_status: row.deliverable_status,
    });
  }

  const { data: apps } = await admin
    .from("campaign_applications")
    .select(CAMPAIGN_CANCEL_SELECT)
    .eq("influencer_id", influencerId)
    .in("status", ["accepted", "cancelled"])
    .limit(30);

  for (const row of apps || []) {
    const name = campaignBrandName(row as Record<string, unknown>);
    if (pairKey(influencerId, name) !== key) continue;
    if (exclude?.source === "campaign" && String(row.id) === exclude.id) continue;
    out.push({
      source: "campaign",
      id: String(row.id),
      influencer_id: influencerId,
      brand_name: name,
      brand_email: campaignBrandEmail(row as Record<string, unknown>),
      status: row.status,
      showcase_admin_hidden: row.showcase_admin_hidden,
      deliverable_warning_sent_at: row.deliverable_warning_sent_at,
      auto_cancelled_at: row.auto_cancelled_at,
      restored_at: row.restored_at,
      reviewed_at: row.reviewed_at,
      delivery_submitted_at: row.delivery_submitted_at,
      delivery_confirmed_at: row.delivery_confirmed_at,
      auto_completed_at: row.auto_completed_at,
      deliverable_url: row.deliverable_url,
      deliverable_status: row.deliverable_status,
    });
  }

  return out;
}

async function applySystemCancel(
  admin: SupabaseClient,
  row: AutocancelRow,
  cancelledAt: string
): Promise<boolean> {
  const base = {
    cancelled_by: "system" as const,
    cancel_reason: DELIVERABLE_AUTOCANCEL_REASON,
    cancelled_at: cancelledAt,
    auto_cancelled_at: cancelledAt,
  };
  if (row.source === "campaign") {
    const { data, error } = await admin
      .from("campaign_applications")
      .update({ status: "cancelled", ...base })
      .eq("id", row.id)
      .eq("status", "accepted")
      .select("id")
      .maybeSingle();
    return !error && !!data?.id;
  }
  const { data, error } = await admin
    .from("proposals")
    .update({ status: "cancelled", ...base })
    .eq("id", row.id)
    .in("status", ["completed", "accepted"])
    .select("id")
    .maybeSingle();
  return !error && !!data?.id;
}

export async function systemAutoCancelRows(
  admin: SupabaseClient,
  primary: AutocancelRow,
  cancelledAt: string
): Promise<string[]> {
  const cancelledIds: string[] = [];
  if (!(await applySystemCancel(admin, primary, cancelledAt))) return cancelledIds;
  cancelledIds.push(`${primary.source}:${primary.id}`);

  const siblings = await findSiblingDeals(admin, primary.source, primary.influencer_id, primary.brand_name);
  for (const sib of siblings) {
    if (sib.id === primary.id && sib.source === primary.source) continue;
    const st = String(sib.status || "").toLowerCase();
    if (st === "cancelled") continue;
    if (hasSubmittedDeliverable(sib)) continue;
  if (sib.source === "proposal" && isRealDeliveryComplete(sib)) continue;
    if (sib.source === "campaign" && isCampaignRealDeliveryComplete(sib)) continue;
    if (await applySystemCancel(admin, sib, cancelledAt)) {
      cancelledIds.push(`${sib.source}:${sib.id}`);
    }
  }

  await revalidatePublicProfileById(admin, primary.influencer_id).catch(() => undefined);
  return cancelledIds;
}

export async function stampDeliverableWarningBoth(
  admin: SupabaseClient,
  primary: AutocancelRow,
  sentAt: string
): Promise<void> {
  const stamp = { deliverable_warning_sent_at: sentAt };
  if (primary.source === "campaign") {
    await admin
      .from("campaign_applications")
      .update(stamp)
      .eq("id", primary.id)
      .is("deliverable_warning_sent_at", null);
  } else {
    await admin.from("proposals").update(stamp).eq("id", primary.id).is("deliverable_warning_sent_at", null);
  }

  const siblings = await findSiblingDeals(admin, primary.source, primary.influencer_id, primary.brand_name);
  for (const sib of siblings) {
    if (sib.deliverable_warning_sent_at) continue;
    if (hasSubmittedDeliverable(sib)) continue;
    if (sib.source === "campaign") {
      await admin
        .from("campaign_applications")
        .update(stamp)
        .eq("id", sib.id)
        .is("deliverable_warning_sent_at", null);
    } else {
      await admin.from("proposals").update(stamp).eq("id", sib.id).is("deliverable_warning_sent_at", null);
    }
  }
}

export async function adminRestoreDeal(
  admin: SupabaseClient,
  source: CollaboratorSource,
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const restoredAt = new Date().toISOString();
  const patch = {
    status: source === "campaign" ? "accepted" : "completed",
    cancelled_at: null,
    cancelled_by: null,
    cancel_reason: null,
    auto_cancelled_at: null,
    deliverable_warning_sent_at: null,
    restored_at: restoredAt,
  };

  if (source === "campaign") {
    const { data, error } = await admin
      .from("campaign_applications")
      .update(patch)
      .eq("id", id)
      .eq("status", "cancelled")
      .select("influencer_id")
      .maybeSingle();
    if (error || !data?.influencer_id) return { ok: false, error: "restore_failed" };
    await revalidatePublicProfileById(admin, String(data.influencer_id)).catch(() => undefined);
    return { ok: true };
  }

  const { data, error } = await admin
    .from("proposals")
    .update(patch)
    .eq("id", id)
    .eq("status", "cancelled")
    .select("influencer_id")
    .maybeSingle();
  if (error || !data?.influencer_id) return { ok: false, error: "restore_failed" };
  await revalidatePublicProfileById(admin, String(data.influencer_id)).catch(() => undefined);
  return { ok: true };
}

export function brandsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeBrandKey(a) === normalizeBrandKey(b) && normalizeBrandKey(a).length > 0;
}

/** When user/admin cancels one side of a paired deal, cancel the sibling if still no deliverable. */
export async function cancelPairedSiblingIfNeeded(
  admin: SupabaseClient,
  source: CollaboratorSource,
  id: string,
  influencerId: string,
  brandName: string,
  cancelledBy: "brand" | "influencer" | "admin",
  reason: string,
  cancelledAt: string
): Promise<void> {
  const siblings = await findSiblingDeals(admin, source, influencerId, brandName, { source, id });
  for (const sib of siblings) {
    const st = String(sib.status || "").toLowerCase();
    if (st === "cancelled") continue;
    if (hasSubmittedDeliverable(sib)) continue;
    const base = {
      cancelled_by: cancelledBy,
      cancel_reason: reason,
      cancelled_at: cancelledAt,
    };
    if (sib.source === "campaign") {
      await admin
        .from("campaign_applications")
        .update({ status: "cancelled", ...base })
        .eq("id", sib.id)
        .eq("status", "accepted");
    } else {
      await admin
        .from("proposals")
        .update({ status: "cancelled", ...base })
        .eq("id", sib.id)
        .in("status", ["completed", "accepted"]);
    }
  }
  await revalidatePublicProfileById(admin, influencerId).catch(() => undefined);
}