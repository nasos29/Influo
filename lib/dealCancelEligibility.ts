import { isRealDeliveryComplete } from "@/lib/deliveryCompletion";

export const CANCEL_REASON_MIN = 10;
export const CANCEL_REASON_MAX = 1000;

export type CancelledBy = "brand" | "influencer" | "admin";

export type DealCancelGate = {
  status?: string | null;
  delivery_confirmed_at?: string | null;
  auto_completed_at?: string | null;
};

/** Trimmed reason length OK for cancel API (min 10, max 1000). */
export function validateCancelReason(raw: unknown): { ok: true; reason: string } | { ok: false; error: string } {
  const reason = typeof raw === "string" ? raw.trim() : "";
  if (reason.length < CANCEL_REASON_MIN) {
    return { ok: false, error: "cancel_reason_too_short" };
  }
  if (reason.length > CANCEL_REASON_MAX) {
    return { ok: false, error: "cancel_reason_too_long" };
  }
  return { ok: true, reason };
}

/** Started deal (accepted/completed) that is not really finished and not already cancelled/rejected. */
function counterIsPending(counter_proposal_status: string | null | undefined): boolean {
  return (counter_proposal_status || "none").toLowerCase() === "pending";
}

/** Brand may withdraw a direct proposal that is still pending (not an open counter). */
export function canWithdrawPendingProposal(
  row: { status?: string | null; counter_proposal_status?: string | null } | null | undefined
): boolean {
  if (!row) return false;
  const status = String(row.status || "").toLowerCase();
  if (status !== "pending") return false;
  if (counterIsPending(row.counter_proposal_status)) return false;
  return true;
}

/** Optional note on withdraw (unlike deal cancel, no minimum length). */
export function validateWithdrawReason(
  raw: unknown
): { ok: true; reason: string | null } | { ok: false; error: string } {
  if (raw == null || raw === "") return { ok: true, reason: null };
  const reason = typeof raw === "string" ? raw.trim() : "";
  if (!reason) return { ok: true, reason: null };
  if (reason.length > CANCEL_REASON_MAX) {
    return { ok: false, error: "withdraw_reason_too_long" };
  }
  return { ok: true, reason };
}

export function canCancelDeal(row: DealCancelGate | null | undefined): boolean {
  if (!row) return false;
  const status = String(row.status || "").toLowerCase();
  if (status === "cancelled" || status === "canceled" || status === "rejected") return false;
  if (status !== "accepted" && status !== "completed") return false;
  if (isRealDeliveryComplete(row)) return false;
  return true;
}

export function cancelledByDisplay(by: string | null | undefined, lang: "el" | "en"): string {
  const key = String(by || "").toLowerCase();
  if (key === "brand") return lang === "en" ? "Brand" : "Επιχείρηση";
  if (key === "influencer") return lang === "en" ? "Creator" : "Δημιουργός";
  if (key === "admin") return lang === "en" ? "Admin" : "Διαχείριση";
  return "—";
}