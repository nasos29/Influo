/**
 * Campaign application (accepted deal) real completion — mirrors proposals plus deliverable_status=approved.
 */

export function isCampaignRealDeliveryComplete(row: {
  delivery_confirmed_at?: string | null;
  auto_completed_at?: string | null;
  deliverable_status?: string | null;
}): boolean {
  if (row.delivery_confirmed_at || row.auto_completed_at) return true;
  return (row.deliverable_status || "").toLowerCase() === "approved";
}

/** Instant used for review scheduling on campaign deals. */
export function campaignRealCompletionAt(row: {
  delivery_confirmed_at?: string | null;
  auto_completed_at?: string | null;
  deliverable_status?: string | null;
  reviewed_at?: string | null;
}): string | null {
  if (row.delivery_confirmed_at) return row.delivery_confirmed_at;
  if (row.auto_completed_at) return row.auto_completed_at;
  if ((row.deliverable_status || "").toLowerCase() === "approved") {
    return row.reviewed_at || null;
  }
  return null;
}