export type CampaignAudience =
  | { kind: "anonymous" }
  | { kind: "brand"; owns: boolean }
  | { kind: "influencer" };

/** Who is looking at a public campaign, and whether they own it. */
export function campaignAudience(input: {
  signedIn: boolean;
  influencerId: string | null;
  brandId: string | null;
  campaignBrandId: string | null;
}): CampaignAudience {
  if (!input.signedIn) return { kind: "anonymous" };
  if (input.brandId && input.campaignBrandId && input.brandId === input.campaignBrandId) {
    return { kind: "brand", owns: true };
  }
  if (input.influencerId) return { kind: "influencer" };
  return { kind: "brand", owns: false };
}
