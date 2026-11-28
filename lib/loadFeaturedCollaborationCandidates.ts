import { supabaseService } from "@/lib/apiAuth";
import {
  isFeaturedCollaborationUuid,
  parseFeaturedCollaborationProposalId,
} from "@/lib/homepageFeaturedCollaborations";
import { mediaFromRow, normalizeSourceUrl } from "@/lib/creatorMedia";

export type FeaturedCollaborationCandidate = {
  curatedId: string;
  brandName: string;
  influencerName: string;
  label: string;
};

type AppRow = {
  id: string;
  influencer_id: string;
  deliverable_url: string | null;
  brand_campaigns?: {
    brands?: { brand_name?: string | null } | { brand_name?: string | null }[] | null;
  } | null;
};

type ProposalRow = {
  id: number;
  influencer_id: string;
  brand_name: string | null;
  published_post_url: string | null;
};

function brandNameFromApp(row: AppRow): string {
  const campaignRaw = row.brand_campaigns;
  const campaign = Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw;
  const brandsRaw = campaign?.brands;
  const brand = Array.isArray(brandsRaw) ? brandsRaw[0] : brandsRaw;
  const name = typeof brand?.brand_name === "string" ? brand.brand_name.trim() : "";
  return name || "Brand";
}

/** Collaborations with ready self-hosted playback (for homepage featured picker). */
export async function loadFeaturedCollaborationCandidates(
  limit = 120
): Promise<FeaturedCollaborationCandidate[]> {
  const admin = supabaseService();
  const entries: Array<{
    curatedId: string;
    influencerId: string;
    sourceUrl: string;
    brandName: string;
  }> = [];

  try {
    const { data, error } = await admin
      .from("campaign_applications")
      .select(
        "id, influencer_id, deliverable_url, brand_campaigns ( brands ( brand_name ) )"
      )
      .eq("deliverable_status", "approved")
      .not("deliverable_url", "is", null)
      .order("reviewed_at", { ascending: false })
      .limit(limit);
    if (!error && Array.isArray(data)) {
      for (const row of data as AppRow[]) {
        if (!isFeaturedCollaborationUuid(row.id)) continue;
        const url = typeof row.deliverable_url === "string" ? row.deliverable_url.trim() : "";
        if (!url) continue;
        entries.push({
          curatedId: row.id,
          influencerId: String(row.influencer_id || ""),
          sourceUrl: url,
          brandName: brandNameFromApp(row),
        });
      }
    }
  } catch (err) {
    console.error("loadFeaturedCollaborationCandidates apps", err);
  }

  try {
    const { data, error } = await admin
      .from("proposals")
      .select("id, influencer_id, brand_name, published_post_url")
      .eq("status", "completed")
      .not("published_post_url", "is", null)
      .order("agreement_accepted_at", { ascending: false })
      .limit(limit);
    if (!error && Array.isArray(data)) {
      for (const row of data as ProposalRow[]) {
        const published =
          typeof row.published_post_url === "string" ? row.published_post_url.trim() : "";
        if (!published) continue;
        const proposalId = parseFeaturedCollaborationProposalId(`proposal:${row.id}`);
        if (proposalId === null) continue;
        entries.push({
          curatedId: `proposal:${row.id}`,
          influencerId: String(row.influencer_id || ""),
          sourceUrl: published,
          brandName:
            (typeof row.brand_name === "string" && row.brand_name.trim()) || "Brand",
        });
      }
    }
  } catch (err) {
    console.error("loadFeaturedCollaborationCandidates proposals", err);
  }

  const influencerIds = [...new Set(entries.map((e) => e.influencerId).filter(Boolean))];
  const nameById = new Map<string, string>();
  if (influencerIds.length > 0) {
    try {
      const { data, error } = await admin
        .from("influencers")
        .select("id, display_name")
        .in("id", influencerIds);
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          if (typeof row.id !== "string") continue;
          const name =
            typeof row.display_name === "string" ? row.display_name.trim() : "";
          if (name) nameById.set(row.id, name);
        }
      }
    } catch (err) {
      console.error("loadFeaturedCollaborationCandidates influencers", err);
    }
  }

  const mediaPlayable = new Set<string>();
  if (influencerIds.length > 0) {
    try {
      const { data, error } = await admin
        .from("creator_media")
        .select(
          "influencer_id, source_url, kind, folder_path, play_path, av1_path, hevc_path, poster_path, duration_ms, width, height, status"
        )
        .in("influencer_id", influencerIds)
        .eq("status", "ready");
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const hosted = mediaFromRow(row);
          if (!hosted?.playUrl) continue;
          mediaPlayable.add(`${row.influencer_id}:${normalizeSourceUrl(row.source_url)}`);
        }
      }
    } catch (err) {
      console.error("loadFeaturedCollaborationCandidates media", err);
    }
  }

  const out: FeaturedCollaborationCandidate[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.curatedId)) continue;
    const key = `${entry.influencerId}:${normalizeSourceUrl(entry.sourceUrl)}`;
    if (!mediaPlayable.has(key)) continue;
    const influencerName = nameById.get(entry.influencerId) || "Creator";
    seen.add(entry.curatedId);
    out.push({
      curatedId: entry.curatedId,
      brandName: entry.brandName,
      influencerName,
      label: `${influencerName} — ${entry.brandName}`,
    });
  }
  return out;
}