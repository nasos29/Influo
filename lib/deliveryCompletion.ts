/**
 * Real collaboration completion helpers.
 * Agreement acceptance still sets status='completed' (work started / past brands).
 * Real completion = delivery_confirmed_at OR auto_completed_at.
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
    return lang === "el" ? "Αυτόματη ολοκλήρωση" : "Auto-completed";
  }
  if (row.delivery_confirmed_at) {
    return lang === "el" ? "Παράδοση επιβεβαιωμένη" : "Delivery confirmed";
  }
  if (row.delivery_submitted_at || row.published_post_pending_approval) {
    if (row.delivery_mode === "event") {
      return lang === "el" ? "Αναμονή επιβεβαίωσης event" : "Awaiting event confirmation";
    }
    return lang === "el" ? "Αναμονή έγκρισης link" : "Awaiting link approval";
  }
  if ((row.status || "").toLowerCase() === "completed") {
    return lang === "el" ? "Συμφωνία · εκκρεμεί παράδοση" : "Agreement · deliverable pending";
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
