/**
 * When reviews may be prompted or submitted (real delivery completion, not agreement lock).
 */

import { isCampaignRealDeliveryComplete } from "@/lib/campaignDealCompletion";
import { isRealDeliveryComplete } from "@/lib/deliveryCompletion";

export type ProposalReviewEligibilityRow = {
  status?: string | null;
  influencer_agreement_accepted?: boolean | null;
  brand_agreement_accepted?: boolean | null;
  delivery_confirmed_at?: string | null;
  auto_completed_at?: string | null;
};

export type CampaignReviewEligibilityRow = {
  status?: string | null;
  deliverable_status?: string | null;
  delivery_confirmed_at?: string | null;
  auto_completed_at?: string | null;
};

export function isProposalAgreementLocked(row: ProposalReviewEligibilityRow): boolean {
  if (!row.influencer_agreement_accepted || !row.brand_agreement_accepted) return false;
  const status = (row.status || "").toLowerCase();
  return status === "completed" || status === "accepted";
}

export function isProposalEligibleForReview(row: ProposalReviewEligibilityRow): boolean {
  return isProposalAgreementLocked(row) && isRealDeliveryComplete(row);
}

export function isCampaignEligibleForReview(row: CampaignReviewEligibilityRow): boolean {
  return (row.status || "").toLowerCase() === "accepted" && isCampaignRealDeliveryComplete(row);
}

export function realCompletionRequiredMessage(lang: string): string {
  return lang === "el"
    ? "Μπορείτε να αξιολογήσετε μόνο αφού επιβεβαιωθεί η παράδοση / ολοκληρωθεί πραγματικά η συνεργασία — όχι μόνο μετά την αποδοχή της συμφωνίας. Μετράει και η εγκεκριμένη παράδοση σε καμπάνια μέσω Influo."
    : "You can review only after the deliverable has been confirmed or the collaboration is actually completed — not merely after the agreement is accepted. An approved campaign deliverable through Influo also counts.";
}

export function collabRequiredMessage(lang: string): string {
  return lang === "el"
    ? "Μπορείτε να αξιολογήσετε μόνο counterparts με τους οποίους έχετε ολοκληρώσει συνεργασία στο Influo."
    : "You can only review counterparts you have actually completed a collaboration with on Influo.";
}