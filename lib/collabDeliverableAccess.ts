import { supabaseService } from "@/lib/apiAuth";
import { loadProposal, partyOf } from "@/lib/proposalAccess";
import type { ChatActor } from "@/lib/chatActor";

export type CollabSource = "proposal" | "campaign";

export async function ownCampaignApplicationParty(
  applicationId: string,
  userId: string,
  userEmail: string
): Promise<"influencer" | "brand" | null> {
  const admin = supabaseService();
  const { data: app } = await admin
    .from("campaign_applications")
    .select("id, influencer_id, brand_campaigns ( brand_id, brands ( contact_email ) )")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return null;
  const campaignRaw = app.brand_campaigns as unknown;
  const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as {
    brand_id?: string;
    brands?: { contact_email?: string } | { contact_email?: string }[] | null;
  } | null;
  const brandId = typeof campaign?.brand_id === "string" ? campaign.brand_id : "";
  const brandRow = Array.isArray(campaign?.brands) ? campaign?.brands[0] : campaign?.brands;
  const brandEmail = (brandRow?.contact_email || "").trim().toLowerCase();
  const email = userEmail.trim().toLowerCase();

  const { data: influencer } = await admin
    .from("influencers")
    .select("id, auth_user_id, contact_email")
    .eq("id", app.influencer_id)
    .maybeSingle();
  if (!influencer) return null;
  const ownsInfluencer =
    influencer.auth_user_id === userId ||
    (!influencer.auth_user_id &&
      !!email &&
      (influencer.contact_email || "").trim().toLowerCase() === email);
  if (ownsInfluencer) return "influencer";
  if (brandId && brandId === userId) return "brand";
  if (brandEmail && email && brandEmail === email) return "brand";
  return null;
}

export async function partyForCollab(
  source: CollabSource,
  id: string,
  actor: ChatActor & { user: { id: string; email?: string } }
): Promise<"influencer" | "brand" | null> {
  if (source === "proposal") {
    const proposal = await loadProposal(id);
    if (!proposal) return null;
    return partyOf(actor, proposal);
  }
  const email = (actor.user.email || "").trim().toLowerCase();
  return ownCampaignApplicationParty(id, actor.user.id, email);
}

export async function influencerIdForCollab(source: CollabSource, id: string): Promise<string | null> {
  const admin = supabaseService();
  if (source === "proposal") {
    const { data } = await admin.from("proposals").select("influencer_id").eq("id", id).maybeSingle();
    return data?.influencer_id ? String(data.influencer_id) : null;
  }
  const { data } = await admin.from("campaign_applications").select("influencer_id").eq("id", id).maybeSingle();
  return data?.influencer_id ? String(data.influencer_id) : null;
}