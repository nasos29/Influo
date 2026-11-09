/** Campaign invite/accept proposals store the campaign title in service_type. */
export const CAMPAIGN_SERVICE_PREFIX = /^(?:Καμπάνια|Campaign):\s*/;

export function isCampaignServiceType(serviceType: string): boolean {
  return CAMPAIGN_SERVICE_PREFIX.test(serviceType);
}

/** Active collaboration statuses that must not be duplicated per brand+creator+campaign label. */
export const ACTIVE_PROPOSAL_STATUSES = ["pending", "accepted"] as const;

export type ActiveCampaignProposalMatch = {
  brandId: string;
  influencerId: string;
  serviceType: string;
};

/**
 * Whether a new campaign proposal would collide with an existing active one.
 * Used by accept + invite/create flows; non-campaign service types are never blocked here.
 */
export function shouldBlockDuplicateCampaignProposal(
  serviceType: string,
  existingActiveCount: number
): boolean {
  if (!isCampaignServiceType(serviceType)) return false;
  return existingActiveCount > 0;
}
