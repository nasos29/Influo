/**
 * Real collaboration completion helpers.
 * Agreement acceptance still sets status='completed' (work started / past brands).
 * Real completion = delivery_confirmed_at OR auto_completed_at.
 *
 * 7-day auto-complete applies ONLY to link mode (published post URL submitted).
 * Event mode never auto-completes — admin is notified and may complete manually.
 * Unsubmitted / abandoned deals stay «Σε εξέλιξη».
 */

export type DeliveryMode = "link" | "event";

export function asDeliveryMode(value: unknown): DeliveryMode | null {
  return value === "link" || value === "event" ? value : null;
}

/** True when brand confirmed or auto-complete safety net fired. */
export function isRealDeliveryComplete(row: {
  delivery_confirmed_at?: string | null;
  auto_completed_at?: string | null;
}): boolean {
  return !!(row.delivery_confirmed_at || row.auto_completed_at);
}

/** Link-mode campaign auto-complete applies only while brand has not requested changes. */
export function isCampaignLinkAutoCompleteDeliverable(
  deliverable_status: string | null | undefined
): boolean {
  return deliverable_status === "submitted";
}

/** Link-mode proposal auto-complete: submitted or legacy null only (not changes_requested). */
export function isProposalLinkAutoCompleteDeliverable(
  deliverable_status: string | null | undefined
): boolean {
  if (!deliverable_status) return true;
  return deliverable_status === "submitted";
}

/**
 * Cron may auto-complete only link-mode submissions (published link).
 * Event mode and rows with no submission are never auto-completed.
 */
export function shouldAutoCompleteDelivery(row: {
  delivery_mode?: string | null;
  delivery_submitted_at?: string | null;
}): boolean {
  return row.delivery_mode === "link" && !!row.delivery_submitted_at;
}

/** Event delivery submitted, waiting on brand (or admin) confirmation. */
export function isEventConfirmPending(row: {
  delivery_mode?: string | null;
  delivery_submitted_at?: string | null;
  delivery_confirmed_at?: string | null;
  auto_completed_at?: string | null;
}): boolean {
  return (
    row.delivery_mode === "event" &&
    !!row.delivery_submitted_at &&
    !row.delivery_confirmed_at &&
    !row.auto_completed_at
  );
}

/** Instant used for review scheduling (prefer confirmed, else auto). */
export function realCompletionAt(row: {
  delivery_confirmed_at?: string | null;
  auto_completed_at?: string | null;
}): string | null {
  return row.delivery_confirmed_at || row.auto_completed_at || null;
}

/** Creator has submitted something awaiting brand action. */
export function isDeliveryPendingBrand(row: {
  delivery_submitted_at?: string | null;
  delivery_confirmed_at?: string | null;
  auto_completed_at?: string | null;
}): boolean {
  return (
    !!row.delivery_submitted_at &&
    !row.delivery_confirmed_at &&
    !row.auto_completed_at
  );
}

/** Human-readable delivery state for admin / dashboards. */
export function deliveryStateLabel(
  row: {
    status?: string | null;
    delivery_mode?: string | null;
    delivery_submitted_at?: string | null;
    delivery_confirmed_at?: string | null;
    auto_completed_at?: string | null;
    published_post_url?: string | null;
    published_post_pending_approval?: boolean | null;
    deliverable_status?: string | null;
  },
  lang: "el" | "en" = "el"
): string {
  if (row.auto_completed_at) {
    return lang === "el" ? "Ολοκληρώθηκε (αυτόματα)" : "Completed (auto)";
  }
  if (row.delivery_confirmed_at) {
    return lang === "el" ? "Ολοκληρώθηκε" : "Completed";
  }
  if (row.delivery_submitted_at || row.published_post_pending_approval) {
    if (row.delivery_mode === "event") {
      return lang === "el" ? "Εκκρεμεί επιβεβαίωση" : "Pending confirmation";
    }
    return lang === "el" ? "Σε εξέλιξη · αναμονή έγκρισης link" : "In progress · awaiting link approval";
  }
  if ((row.status || "").toLowerCase() === "completed") {
    return lang === "el" ? "Σε εξέλιξη" : "In progress";
  }
  if (row.deliverable_status === "submitted") {
    return lang === "el" ? "Αναμονή έγκρισης" : "Awaiting approval";
  }
  if (row.deliverable_status === "approved") {
    return lang === "el" ? "Εγκεκριμένο παραδοτέο" : "Deliverable approved";
  }
  return lang === "el" ? "—" : "—";
}

/**
 * Dashboard badge after agreement lock:
 * «Σε εξέλιξη» until real delivery completion, then «Ολοκληρώθηκε».
 */
export function collaborationProgressLabel(
  row: {
    status?: string | null;
    delivery_confirmed_at?: string | null;
    auto_completed_at?: string | null;
  },
  lang: "el" | "en" = "el"
): string {
  if (isRealDeliveryComplete(row)) {
    return lang === "el" ? "Ολοκληρώθηκε" : "Completed";
  }
  if ((row.status || "").toLowerCase() === "completed") {
    return lang === "el" ? "Σε εξέλιξη" : "In progress";
  }
  return lang === "el" ? "—" : "—";
}

/**
 * Event-mode collabs stay out of public «Πρόσφατες συνεργασίες» unless admin
 * explicitly allows (showcase_event_admin_allowed) AND a showable URL exists.
 * Video-only rule from #428 still applies for link mode.
 */
export function mayShowEventCollabPublicly(row: {
  delivery_mode?: string | null;
  showcase_event_admin_allowed?: boolean | null;
  delivery_proof_url?: string | null;
  published_post_url?: string | null;
  deliverable_url?: string | null;
}): boolean {
  if (row.delivery_mode !== "event") return true;
  if (!row.showcase_event_admin_allowed) return false;
  const proof = String(row.delivery_proof_url || "").trim();
  const post = String(row.published_post_url || row.deliverable_url || "").trim();
  return !!(proof || post);
}
