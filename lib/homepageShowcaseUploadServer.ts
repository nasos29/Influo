import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS,
  isFeaturedCollaborationUuid,
} from "@/lib/homepageFeaturedCollaborations";
import { isHomepageShowcaseHostInfluencerUuid } from "@/lib/homepageShowcaseUpload";

export async function resolveHomepageShowcaseUploadHostInfluencerId(
  admin: SupabaseClient
): Promise<string | null> {
  const fromEnv = String(process.env.HOMEPAGE_SHOWCASE_UPLOAD_INFLUENCER_ID || "").trim();
  if (isHomepageShowcaseHostInfluencerUuid(fromEnv)) {
    const { data } = await admin.from("influencers").select("id").eq("id", fromEnv).maybeSingle();
    if (data?.id) return String(data.id);
  }

  const heroAppId = DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS.applicationIds[0]!;
  if (!isFeaturedCollaborationUuid(heroAppId)) return null;
  const { data: app } = await admin
    .from("campaign_applications")
    .select("influencer_id")
    .eq("id", heroAppId)
    .maybeSingle();
  const influencerId = typeof app?.influencer_id === "string" ? app.influencer_id : null;
  if (!influencerId) return null;

  const { data: inf } = await admin.from("influencers").select("id").eq("id", influencerId).maybeSingle();
  return inf?.id ? String(inf.id) : null;
}