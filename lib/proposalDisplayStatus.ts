/**
 * Admin-facing derived proposal status (EL/EN).
 * DB `status=completed` means both parties locked agreement (work started),
 * not necessarily real delivery completion.
 */

import {
  isDeliveryPendingBrand,
  isEventConfirmPending,
  isRealDeliveryComplete,
} from "@/lib/deliveryCompletion";

export const PROPOSAL_DISPLAY_STATUS_KEYS = [
  "pending",
  "awaiting_agreement",
  "in_progress",
  "awaiting_approval",
  "completed",
  "needs_admin",
  "rejected",
  "cancelled",
] as const;

export type ProposalDisplayStatusKey = (typeof PROPOSAL_DISPLAY_STATUS_KEYS)[number];

export type ProposalDisplayStatusAudience = "admin" | "brand" | "creator" | "party";

const PARTY_COLLABORATION_STARTED_KEYS = new Set<ProposalDisplayStatusKey>([
  "awaiting_agreement",
  "in_progress",
  "awaiting_approval",
  "needs_admin",
]);

export type ProposalDisplayStatusRow = {
  status?: string | null;
  influencer_agreement_accepted?: boolean | null;
  brand_agreement_accepted?: boolean | null;
  delivery_mode?: string | null;
  delivery_submitted_at?: string | null;
  delivery_confirmed_at?: string | null;
  auto_completed_at?: string | null;
  published_post_url?: string | null;
  published_post_pending_approval?: boolean | null;
  deliverable_url?: string | null;
};

const LABELS: Record<
  ProposalDisplayStatusKey | "unknown",
  { el: string; en: string }
> = {
  pending: { el: "Εκκρεμεί", en: "Pending" },
  awaiting_agreement: { el: "Αναμονή συμφωνίας", en: "Awaiting agreement" },
  in_progress: { el: "Σε εξέλιξη", en: "In progress" },
  awaiting_approval: { el: "Αναμονή έγκρισης", en: "Awaiting approval" },
  completed: { el: "Ολοκληρώθηκε", en: "Completed" },
  needs_admin: { el: "Χρειάζεται admin", en: "Needs admin" },
  rejected: { el: "Απορρίφθηκε", en: "Rejected" },
  cancelled: { el: "Ακυρώθηκε", en: "Cancelled" },
  unknown: { el: "Άγνωστο", en: "Unknown" },
};

/** Colored badge classes: amber waiting, blue in progress, green done, red rejected, slate cancelled, purple admin. */
export const PROPOSAL_DISPLAY_STATUS_BADGE: Record<ProposalDisplayStatusKey | "unknown", string> = {
  pending: "bg-amber-100 text-amber-800",
  awaiting_agreement: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  awaiting_approval: "bg-amber-100 text-amber-800",
  completed: "bg-emerald-100 text-emerald-800",
  needs_admin: "bg-purple-100 text-purple-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-700",
  unknown: "bg-slate-100 text-slate-700",
};

const KEY_SET = new Set<string>(PROPOSAL_DISPLAY_STATUS_KEYS);

/** Map legacy raw DB filter values to derived keys when still passed. */
export function normalizeProposalDisplayStatusFilter(
  raw: string | null | undefined
): "all" | ProposalDisplayStatusKey {
  const value = String(raw || "all").toLowerCase().trim();
  if (!value || value === "all") return "all";
  if (value === "accepted") return "awaiting_agreement";
  if (value === "canceled") return "cancelled";
  if (KEY_SET.has(value)) return value as ProposalDisplayStatusKey;
  return "all";
}

function hasLinkDeliverable(row: ProposalDisplayStatusRow): boolean {
  const url = String(row.published_post_url || row.deliverable_url || "").trim();
  if (row.published_post_pending_approval) return true;
  if (url) return true;
  return row.delivery_mode === "link" && !!row.delivery_submitted_at;
}

export function deriveProposalDisplayStatusKey(
  row: ProposalDisplayStatusRow
): ProposalDisplayStatusKey | "unknown" {
  const status = String(row.status || "").toLowerCase();

  if (status === "rejected") return "rejected";
  if (status === "cancelled" || status === "canceled") return "cancelled";

  if (isRealDeliveryComplete(row)) return "completed";

  if (isEventConfirmPending(row)) return "needs_admin";

  // Completed agreement + link deliverable submitted, waiting on brand.
  if (status === "completed" && row.delivery_mode !== "event" && hasLinkDeliverable(row)) {
    return "awaiting_approval";
  }

  // Link submitted via delivery_submitted_at even if URL column empty.
  if (
    status === "completed" &&
    row.delivery_mode === "link" &&
    isDeliveryPendingBrand(row)
  ) {
    return "awaiting_approval";
  }

  if (status === "completed") return "in_progress";

  // `accepted` = offer accepted; agreement not locked by both yet.
  if (status === "accepted") return "awaiting_agreement";

  if (status === "pending") return "pending";

  return "unknown";
}

type PartySide = "brand" | "creator";

function partySideFromAudience(audience: ProposalDisplayStatusAudience): PartySide | null {
  if (audience === "admin") return null;
  if (audience === "brand") return "brand";
  return "creator";
}

function partyDisplayStatusLabel(
  key: ProposalDisplayStatusKey | "unknown",
  lang: "el" | "en",
  side: PartySide
): string {
  if (key === "unknown") return LABELS.unknown[lang];
  if (key === "pending") {
    if (side === "brand") return lang === "el" ? "Αναμονή απάντησης" : "Awaiting reply";
    return lang === "el" ? "Πρόταση" : "Proposal";
  }
  if (PARTY_COLLABORATION_STARTED_KEYS.has(key)) {
    return lang === "el" ? "Ξεκίνησε συνεργασία" : "Collaboration started";
  }
  return LABELS[key][lang];
}

export function proposalDisplayStatusLabel(
  key: ProposalDisplayStatusKey | "unknown",
  lang: "el" | "en" = "el",
  audience: ProposalDisplayStatusAudience = "admin"
): string {
  const side = partySideFromAudience(audience);
  if (side) return partyDisplayStatusLabel(key, lang, side);
  return LABELS[key][lang];
}

export function deriveProposalDisplayStatus(
  row: ProposalDisplayStatusRow,
  lang: "el" | "en" = "el",
  audience: ProposalDisplayStatusAudience = "admin"
): {
  key: ProposalDisplayStatusKey | "unknown";
  label: string;
  badgeClass: string;
} {
  const key = deriveProposalDisplayStatusKey(row);
  return {
    key,
    label: proposalDisplayStatusLabel(key, lang, audience),
    badgeClass: PROPOSAL_DISPLAY_STATUS_BADGE[key],
  };
}

/**
 * Apply derived-status filter to a Supabase proposals query.
 * Keeps `count: exact` pagination aligned with the filtered page.
 */
export function applyProposalDisplayStatusFilter(query: any, key: ProposalDisplayStatusKey): any {
  switch (key) {
    case "pending":
      return query.eq("status", "pending");
    case "awaiting_agreement":
      return query.eq("status", "accepted");
    case "rejected":
      return query.eq("status", "rejected");
    case "cancelled":
      return query.in("status", ["cancelled", "canceled"]);
    case "completed":
      return query.or("delivery_confirmed_at.not.is.null,auto_completed_at.not.is.null");
    case "needs_admin":
      return query
        .eq("delivery_mode", "event")
        .not("delivery_submitted_at", "is", null)
        .is("delivery_confirmed_at", null)
        .is("auto_completed_at", null);
    case "awaiting_approval":
      // Completed work, link deliverable present, not real-complete, not event-pending.
      return query
        .eq("status", "completed")
        .is("delivery_confirmed_at", null)
        .is("auto_completed_at", null)
        .or("delivery_mode.is.null,delivery_mode.eq.link")
        .or(
          [
            "and(delivery_mode.eq.link,delivery_submitted_at.not.is.null)",
            "published_post_pending_approval.eq.true",
            "and(published_post_url.not.is.null,published_post_url.neq.)",
          ].join(",")
        );
    case "in_progress":
      return query
        .eq("status", "completed")
        .is("delivery_confirmed_at", null)
        .is("auto_completed_at", null)
        .is("delivery_submitted_at", null)
        .or("published_post_pending_approval.is.null,published_post_pending_approval.eq.false")
        .or("published_post_url.is.null,published_post_url.eq.");
    default:
      return query;
  }
}

/** Filter dropdown options for admin «Προτάσεις». */
export function proposalDisplayStatusFilterOptions(
  lang: "el" | "en"
): Array<{ value: "all" | ProposalDisplayStatusKey; label: string }> {
  return [
    { value: "all", label: lang === "el" ? "Όλες οι καταστάσεις" : "All statuses" },
    ...PROPOSAL_DISPLAY_STATUS_KEYS.map((key) => ({
      value: key,
      label: proposalDisplayStatusLabel(key, lang),
    })),
  ];
}
