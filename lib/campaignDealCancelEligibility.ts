import { isCampaignRealDeliveryComplete } from "@/lib/campaignDealCompletion";
import {
  CANCEL_REASON_MAX,
  CANCEL_REASON_MIN,
  validateCancelReason,
  type CancelledBy,
} from "@/lib/dealCancelEligibility";

export { CANCEL_REASON_MIN, CANCEL_REASON_MAX, validateCancelReason, type CancelledBy };

export type CampaignDealCancelGate = {
  status?: string | null;
  delivery_confirmed_at?: string | null;
  auto_completed_at?: string | null;
  deliverable_status?: string | null;
  auto_cancelled_at?: string | null;
  cancelled_by?: string | null;
};

/** Started campaign deal (accepted), not really finished, not withdrawn/cancelled/rejected. */
export function canCancelCampaignDeal(row: CampaignDealCancelGate | null | undefined): boolean {
  if (!row) return false;
  if (row.auto_cancelled_at) return false;
  if (String(row.cancelled_by || "").toLowerCase() === "system") return false;
  const status = String(row.status || "").toLowerCase();
  if (status === "cancelled" || status === "canceled" || status === "rejected" || status === "withdrawn") {
    return false;
  }
  if (status !== "accepted") return false;
  if (isCampaignRealDeliveryComplete(row)) return false;
  return true;
}