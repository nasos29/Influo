import { athensCalendarDaysElapsed } from "@/lib/athensCalendar";
import { isCampaignRealDeliveryComplete } from "@/lib/campaignDealCompletion";
import {
  DELIVERABLE_AUTOCANCEL_DAYS_AFTER_WARNING,
  DELIVERABLE_AUTOCANCEL_WARNING_DAYS,
  deliverableAutocancelSinceMs,
} from "@/lib/deliveryFlags";
import { isRealDeliveryComplete } from "@/lib/deliveryCompletion";

export type CollaboratorSource = "proposal" | "campaign";

export type AutocancelRow = {
  source: CollaboratorSource;
  id: string;
  influencer_id: string;
  brand_name: string;
  brand_email?: string | null;
  status?: string | null;
  showcase_admin_hidden?: boolean | null;
  deliverable_warning_sent_at?: string | null;
  auto_cancelled_at?: string | null;
  restored_at?: string | null;
  agreement_accepted_at?: string | null;
  reviewed_at?: string | null;
  delivery_submitted_at?: string | null;
  delivery_confirmed_at?: string | null;
  auto_completed_at?: string | null;
  published_post_url?: string | null;
  deliverable_url?: string | null;
  deliverable_status?: string | null;
  delivery_mode?: string | null;
};

export function normalizeBrandKey(name: string | null | undefined): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function pairKey(influencerId: string, brandName: string): string {
  return `${String(influencerId).trim()}::${normalizeBrandKey(brandName)}`;
}

export function isAutocancelBlockedRow(row: {
  auto_cancelled_at?: string | null;
  cancelled_by?: string | null;
  status?: string | null;
}): boolean {
  if (row.auto_cancelled_at) return true;
  if (String(row.cancelled_by || "").toLowerCase() === "system") return true;
  const st = String(row.status || "").toLowerCase();
  return st === "cancelled" && !!row.auto_cancelled_at;
}

export function hasSubmittedDeliverable(row: AutocancelRow): boolean {
  if (row.delivery_submitted_at || row.delivery_confirmed_at || row.auto_completed_at) return true;
  const url = String(row.published_post_url || row.deliverable_url || "").trim();
  if (url) return true;
  const dStatus = (row.deliverable_status || "").toLowerCase();
  if (dStatus === "submitted" || dStatus === "approved") return true;
  if (row.source === "proposal" && isRealDeliveryComplete(row)) return true;
  if (row.source === "campaign" && isCampaignRealDeliveryComplete(row)) return true;
  return false;
}

export function acceptanceInstant(row: AutocancelRow): string | null {
  if (row.restored_at) return row.restored_at;
  if (row.source === "campaign") return row.reviewed_at || null;
  return row.agreement_accepted_at || null;
}

export function isAutomaticWarningEligible(row: AutocancelRow, nowMs: number, sinceMs: number | null): boolean {
  if (row.showcase_admin_hidden) return false;
  if (hasSubmittedDeliverable(row)) return false;
  if (row.deliverable_warning_sent_at) return false;
  if (isAutocancelBlockedRow(row)) return false;
  const accepted = acceptanceInstant(row);
  if (!accepted) return false;
  const acceptedMs = new Date(accepted).getTime();
  if (!Number.isFinite(acceptedMs)) return false;
  if (sinceMs == null || acceptedMs < sinceMs) return false;
  const dueMs = acceptedMs + DELIVERABLE_AUTOCANCEL_WARNING_DAYS * 86_400_000;
  return nowMs >= dueMs;
}

/** Eligible for cron auto-cancel when warning was stamped (manual or auto) and 3 Athens days passed. */
export function isAutocancelDue(row: AutocancelRow, nowMs: number): boolean {
  if (row.showcase_admin_hidden) return false;
  if (hasSubmittedDeliverable(row)) return false;
  if (isAutocancelBlockedRow(row)) return false;
  const warned = row.deliverable_warning_sent_at;
  if (!warned) return false;
  return athensCalendarDaysElapsed(warned, DELIVERABLE_AUTOCANCEL_DAYS_AFTER_WARNING, nowMs);
}

export function isActiveDealForAutocancel(row: AutocancelRow): boolean {
  const st = String(row.status || "").toLowerCase();
  if (row.source === "campaign") return st === "accepted";
  return st === "completed" || st === "accepted";
}

export function passesSinceCutoff(row: AutocancelRow, env?: NodeJS.ProcessEnv): boolean {
  const sinceMs = deliverableAutocancelSinceMs(env);
  if (sinceMs == null) return false;
  const accepted = acceptanceInstant(row);
  if (!accepted) return false;
  const ms = new Date(accepted).getTime();
  return Number.isFinite(ms) && ms >= sinceMs;
}

export function canAdminRestoreDeal(row: {
  status?: string | null;
  auto_cancelled_at?: string | null;
  cancelled_by?: string | null;
  delivery_confirmed_at?: string | null;
  auto_completed_at?: string | null;
  deliverable_status?: string | null;
  delivery_submitted_at?: string | null;
  published_post_url?: string | null;
  deliverable_url?: string | null;
  source?: CollaboratorSource;
}): boolean {
  const st = String(row.status || "").toLowerCase();
  if (st !== "cancelled") return false;
  if (isRealDeliveryComplete(row) || isCampaignRealDeliveryComplete(row)) return false;
  const source = row.source ?? "proposal";
  if (
    hasSubmittedDeliverable({
      source,
      id: "",
      influencer_id: "",
      brand_name: "",
      delivery_submitted_at: row.delivery_submitted_at,
      delivery_confirmed_at: row.delivery_confirmed_at,
      auto_completed_at: row.auto_completed_at,
      published_post_url: row.published_post_url,
      deliverable_url: row.deliverable_url,
      deliverable_status: row.deliverable_status,
    })
  ) {
    return false;
  }
  return true;
}