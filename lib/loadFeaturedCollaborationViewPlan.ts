import { supabaseService } from "@/lib/apiAuth";
import { normalizeSourceUrl } from "@/lib/creatorMedia";
import type { FeaturedCollaborationViewsItem } from "@/lib/homepageFeaturedCollaborationViews";
import type { HomepageFeaturedCollaborationsConfig } from "@/lib/homepageFeaturedCollaborations";
import { getHomepageFeaturedCollaborationsSetting } from "@/lib/siteSettingsServer";

export type FeaturedCollaborationViewPlanItem = {
  applicationId: string;
  url: string;
  views: number | null;
};

type AppRow = {
  id: string;
  influencer_id: string;
  deliverable_url: string | null;
};

type MediaRow = {
  influencer_id: string;
  source_url: string;
  status: string;
};

function viewsForApp(
  applicationId: string,
  stored: FeaturedCollaborationViewsItem[] | undefined
): number | null {
  const row = stored?.find((i) => i.applicationId === applicationId);
  return row && Number.isInteger(row.views) && row.views >= 0 ? row.views : null;
}

/**
 * Resolve public source/deliverable URLs for yt-dlp (same sources as loadFeaturedCollaborations).
 */
export async function loadFeaturedCollaborationViewPlan(
  storedItems?: FeaturedCollaborationViewsItem[],
  config?: HomepageFeaturedCollaborationsConfig
): Promise<{ applicationIds: string[]; items: FeaturedCollaborationViewPlanItem[] }> {
  const setting = config ?? (await getHomepageFeaturedCollaborationsSetting());
  const applicationIds = [...new Set(setting.applicationIds)].filter(Boolean);
  if (applicationIds.length === 0) {
    return { applicationIds: [], items: [] };
  }

  const admin = supabaseService();
  const { data, error } = await admin
    .from("campaign_applications")
    .select("id, influencer_id, deliverable_url")
    .in("id", applicationIds);

  if (error) {
    console.error("loadFeaturedCollaborationViewPlan applications", error);
    return {
      applicationIds,
      items: applicationIds.map((id) => ({
        applicationId: id,
        url: storedItems?.find((i) => i.applicationId === id)?.sourceUrl ?? "",
        views: viewsForApp(id, storedItems),
      })),
    };
  }

  const apps = (data || []) as AppRow[];
  const appById = new Map(apps.map((a) => [a.id, a]));
  const influencerIds = [...new Set(apps.map((a) => a.influencer_id).filter(Boolean))];

  const sourceUrlByKey = new Map<string, string>();
  if (influencerIds.length > 0) {
    const { data: mediaRows, error: mediaErr } = await admin
      .from("creator_media")
      .select("influencer_id, source_url, status")
      .in("influencer_id", influencerIds)
      .eq("status", "ready");
    if (mediaErr) {
      console.error("loadFeaturedCollaborationViewPlan creator_media", mediaErr);
    } else if (Array.isArray(mediaRows)) {
      for (const row of mediaRows as MediaRow[]) {
        const key = `${row.influencer_id}:${normalizeSourceUrl(row.source_url)}`;
        if (!sourceUrlByKey.has(key)) sourceUrlByKey.set(key, row.source_url);
      }
    }
  }

  const items: FeaturedCollaborationViewPlanItem[] = [];
  for (const applicationId of applicationIds) {
    const app = appById.get(applicationId);
    let url = "";
    if (app) {
      const deliverable =
        typeof app.deliverable_url === "string" ? app.deliverable_url.trim() : "";
      if (deliverable) {
        url =
          sourceUrlByKey.get(`${app.influencer_id}:${normalizeSourceUrl(deliverable)}`) ??
          deliverable;
      }
    }
    const storedUrl = storedItems?.find((i) => i.applicationId === applicationId)?.sourceUrl;
    if (!url && storedUrl) url = storedUrl;
    items.push({
      applicationId,
      url,
      views: viewsForApp(applicationId, storedItems),
    });
  }

  return { applicationIds, items };
}