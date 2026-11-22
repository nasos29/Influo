import { supabaseService } from "@/lib/apiAuth";
import { normalizeSourceUrl } from "@/lib/creatorMedia";
import type { FeaturedCollaborationViewsItem } from "@/lib/homepageFeaturedCollaborationViews";
import {
  isFeaturedCollaborationUuid,
  parseFeaturedCollaborationProposalId,
  type HomepageFeaturedCollaborationsConfig,
} from "@/lib/homepageFeaturedCollaborations";
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

type ProposalRow = {
  id: number;
  influencer_id: string;
  published_post_url: string | null;
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

  const uuidIds = applicationIds.filter(isFeaturedCollaborationUuid);
  const proposalIds = applicationIds
    .map((id) => parseFeaturedCollaborationProposalId(id))
    .filter((n): n is number => n !== null);

  const admin = supabaseService();

  const appById = new Map<string, AppRow>();
  if (uuidIds.length > 0) {
    const { data, error } = await admin
      .from("campaign_applications")
      .select("id, influencer_id, deliverable_url")
      .in("id", uuidIds);

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
    for (const a of apps) appById.set(a.id, a);
  }

  const proposalById = new Map<number, ProposalRow>();
  if (proposalIds.length > 0) {
    const { data, error } = await admin
      .from("proposals")
      .select("id, influencer_id, published_post_url")
      .in("id", proposalIds);
    if (error) {
      console.error("loadFeaturedCollaborationViewPlan proposals", error);
    } else if (Array.isArray(data)) {
      for (const row of data as ProposalRow[]) {
        if (typeof row.id === "number") proposalById.set(row.id, row);
      }
    }
  }

  const influencerIds = [
    ...new Set([
      ...[...appById.values()].map((a) => a.influencer_id),
      ...[...proposalById.values()].map((p) => p.influencer_id),
    ]),
  ].filter(Boolean);

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
    let url = "";
    let influencerId = "";
    let sourceCandidate = "";

    if (isFeaturedCollaborationUuid(applicationId)) {
      const app = appById.get(applicationId);
      if (app) {
        influencerId = app.influencer_id;
        const deliverable =
          typeof app.deliverable_url === "string" ? app.deliverable_url.trim() : "";
        sourceCandidate = deliverable;
      }
    } else {
      const proposalId = parseFeaturedCollaborationProposalId(applicationId);
      const proposal = proposalId !== null ? proposalById.get(proposalId) : undefined;
      if (proposal) {
        influencerId = proposal.influencer_id;
        sourceCandidate =
          typeof proposal.published_post_url === "string"
            ? proposal.published_post_url.trim()
            : "";
      }
    }

    if (sourceCandidate && influencerId) {
      url =
        sourceUrlByKey.get(`${influencerId}:${normalizeSourceUrl(sourceCandidate)}`) ??
        sourceCandidate;
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