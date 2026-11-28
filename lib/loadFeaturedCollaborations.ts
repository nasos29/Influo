import { supabaseService } from "@/lib/apiAuth";
import { mediaFromRow, normalizeSourceUrl, type HostedMedia } from "@/lib/creatorMedia";
import {
  featuredCollaborationPlatform,
  type FeaturedCollaborationPlatform,
} from "@/lib/featuredCollaborationPlatform";
import {
  DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS,
  isFeaturedCollaborationUuid,
  parseFeaturedCollaborationProposalId,
  parseFeaturedCollaborationUploadId,
  type HomepageFeaturedCollaborationsConfig,
} from "@/lib/homepageFeaturedCollaborations";
import { homepageShowcaseUploadSourceVideoId } from "@/lib/homepageShowcaseUpload";
import { publicProfilePath } from "@/lib/profileSlug";
import { featuredCollaborationViewsTotal } from "@/lib/homepageFeaturedCollaborationViews";
import { DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO } from "@/lib/homepageBrandCtaDecorativePhoto";
import {
  getHomepageBrandCtaDecorativePhotoSetting,
  getHomepageFeaturedCollaborationViewsSetting,
  getHomepageFeaturedCollaborationsSetting,
} from "@/lib/siteSettingsServer";

export type { FeaturedCollaborationPlatform } from "@/lib/featuredCollaborationPlatform";

export type FeaturedCollaborationCard = {
  /** Curated id: campaign_application UUID or `proposal:<id>`. */
  applicationId: string;
  influencerName: string;
  influencerProfileHref: string;
  influencerAvatarUrl: string | null;
  playUrl: string;
  posterUrl: string | null;
  /** Original deliverable / published URL (for hosted lookup + embed fallback). */
  sourcePostUrl: string;
  hostedMedia: HostedMedia;
  platform: FeaturedCollaborationPlatform | null;
  /** Stored public views for this curated id; hidden in UI when null. */
  publicViews: number | null;
};

export type FeaturedCollaborationsShowcaseData = {
  brandName: string;
  brandLogoUrl: string | null;
  decorativeCoverUrl: string | null;
  /** Decorative food collage beside the showcase (site_settings or default). */
  decorativePhotoUrl: string;
  cards: FeaturedCollaborationCard[];
  /** First card in layout order (hero preference applied). */
  initialHeroApplicationId: string;
  /** Sum of public views for all curated application ids; hidden in UI when null. */
  totalViews: number | null;
};

type AppRow = {
  id: string;
  influencer_id: string;
  deliverable_url: string | null;
  brand_campaigns?: unknown;
};

type ProposalRow = {
  id: number;
  influencer_id: string;
  published_post_url: string | null;
};

type MediaRow = {
  influencer_id: string;
  source_url: string;
  kind: string;
  folder_path: string;
  play_path?: string | null;
  av1_path?: string | null;
  hevc_path?: string | null;
  poster_path?: string | null;
  duration_ms?: number | null;
  width?: number | null;
  height?: number | null;
  status: string;
};

function campaignBrandFromRow(row: AppRow): {
  brandName: string;
  brandLogoUrl: string | null;
  coverUrl: string | null;
} {
  const campaignRaw = row.brand_campaigns;
  const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as
    | {
        cover_url?: string | null;
        brands?:
          | { brand_name?: string | null; logo_url?: string | null }
          | { brand_name?: string | null; logo_url?: string | null }[]
          | null;
      }
    | null;
  const brandRow = Array.isArray(campaign?.brands) ? campaign?.brands[0] : campaign?.brands;
  const brandName =
    (typeof brandRow?.brand_name === "string" && brandRow.brand_name.trim()) || "Brand";
  const brandLogoUrl =
    typeof brandRow?.logo_url === "string" && brandRow.logo_url.trim()
      ? brandRow.logo_url.trim()
      : null;
  const coverUrl =
    typeof campaign?.cover_url === "string" && campaign.cover_url.trim()
      ? campaign.cover_url.trim()
      : null;
  return { brandName, brandLogoUrl, coverUrl };
}

function splitCuratedIds(ids: string[]): {
  uuidIds: string[];
  proposalKeys: { curatedId: string; proposalId: number }[];
  uploadKeys: { curatedId: string; uploadId: string }[];
} {
  const uuidIds: string[] = [];
  const proposalKeys: { curatedId: string; proposalId: number }[] = [];
  const uploadKeys: { curatedId: string; uploadId: string }[] = [];
  for (const id of ids) {
    if (isFeaturedCollaborationUuid(id)) {
      uuidIds.push(id);
      continue;
    }
    const uploadId = parseFeaturedCollaborationUploadId(id);
    if (uploadId !== null) {
      uploadKeys.push({ curatedId: String(id).trim(), uploadId });
      continue;
    }
    const proposalId = parseFeaturedCollaborationProposalId(id);
    if (proposalId !== null) proposalKeys.push({ curatedId: id, proposalId });
  }
  return { uuidIds, proposalKeys, uploadKeys };
}

function publicViewsForCuratedId(
  curatedId: string,
  items: { applicationId: string; views: number }[] | undefined
): number | null {
  const row = items?.find((i) => i.applicationId === curatedId);
  return row && Number.isInteger(row.views) && row.views >= 0 ? row.views : null;
}

export async function loadFeaturedCollaborations(
  config?: HomepageFeaturedCollaborationsConfig
): Promise<FeaturedCollaborationsShowcaseData | null> {
  const setting = config ?? (await getHomepageFeaturedCollaborationsSetting());
  const applicationIds = [...new Set(setting.applicationIds)].filter(Boolean);
  if (applicationIds.length === 0) return null;

  const { uuidIds, proposalKeys, uploadKeys } = splitCuratedIds(applicationIds);

  const admin = supabaseService();
  const APP_COLS =
    "id, influencer_id, deliverable_url, brand_campaigns!inner ( cover_url, brand_id, brands ( brand_name, logo_url ) )";

  let apps: AppRow[] = [];
  if (uuidIds.length > 0) {
    try {
      const { data, error } = await admin
        .from("campaign_applications")
        .select(APP_COLS)
        .in("id", uuidIds);
      if (error) {
        const legacy =
          "id, influencer_id, deliverable_url, brand_campaigns!inner ( brand_id, brands ( brand_name, logo_url ) )";
        const second = await admin.from("campaign_applications").select(legacy).in("id", uuidIds);
        if (second.error) {
          console.error("loadFeaturedCollaborations applications", second.error);
        } else {
          apps = (second.data || []) as AppRow[];
        }
      } else {
        apps = (data || []) as AppRow[];
      }
    } catch (error) {
      console.error("loadFeaturedCollaborations applications", error);
    }
  }

  const appById = new Map<string, AppRow>();
  for (const row of apps) {
    if (typeof row.id === "string") appById.set(row.id, row);
  }

  const proposalById = new Map<number, ProposalRow>();
  if (proposalKeys.length > 0) {
    const numericIds = proposalKeys.map((p) => p.proposalId);
    try {
      const { data, error } = await admin
        .from("proposals")
        .select("id, influencer_id, published_post_url")
        .in("id", numericIds);
      if (error) {
        console.error("loadFeaturedCollaborations proposals", error);
      } else if (Array.isArray(data)) {
        for (const row of data as ProposalRow[]) {
          if (typeof row.id === "number") proposalById.set(row.id, row);
        }
      }
    } catch (error) {
      console.error("loadFeaturedCollaborations proposals", error);
    }
  }

  const uploadMediaBySourceVideoId = new Map<string, ReturnType<typeof mediaFromRow>>();
  if (uploadKeys.length > 0) {
    const sourceVideoIds = uploadKeys.map((u) => homepageShowcaseUploadSourceVideoId(u.uploadId));
    try {
      const { data, error } = await admin
        .from("creator_media")
        .select(
          "influencer_id, source_url, kind, folder_path, play_path, av1_path, hevc_path, poster_path, duration_ms, width, height, status, source_video_id"
        )
        .in("source_video_id", sourceVideoIds)
        .eq("status", "ready");
      if (error) {
        console.error("loadFeaturedCollaborations showcase uploads", error);
      } else if (Array.isArray(data)) {
        for (const row of data as (MediaRow & { source_video_id?: string | null })[]) {
          const key =
            typeof row.source_video_id === "string" ? row.source_video_id.trim().toLowerCase() : "";
          if (!key || uploadMediaBySourceVideoId.has(key)) continue;
          const hosted = mediaFromRow(row);
          if (hosted) uploadMediaBySourceVideoId.set(key, hosted);
        }
      }
    } catch (error) {
      console.error("loadFeaturedCollaborations showcase uploads", error);
    }
  }

  type OrderedEntry =
    | { kind: "app"; curatedId: string; app: AppRow; sourceUrl: string }
    | { kind: "proposal"; curatedId: string; proposal: ProposalRow; sourceUrl: string }
    | { kind: "upload"; curatedId: string; uploadId: string; sourceUrl: string; hosted: HostedMedia };

  const orderedEntries: OrderedEntry[] = [];
  for (const curatedId of applicationIds) {
    if (isFeaturedCollaborationUuid(curatedId)) {
      const app = appById.get(curatedId);
      if (!app) continue;
      const deliverable =
        typeof app.deliverable_url === "string" ? app.deliverable_url.trim() : "";
      if (!deliverable) continue;
      orderedEntries.push({ kind: "app", curatedId, app, sourceUrl: deliverable });
      continue;
    }
    const uploadId = parseFeaturedCollaborationUploadId(curatedId);
    if (uploadId !== null) {
      const hosted = uploadMediaBySourceVideoId.get(homepageShowcaseUploadSourceVideoId(uploadId));
      if (!hosted?.playUrl) continue;
      orderedEntries.push({
        kind: "upload",
        curatedId: String(curatedId).trim(),
        uploadId,
        sourceUrl: hosted.sourceUrl,
        hosted,
      });
      continue;
    }
    const proposalId = parseFeaturedCollaborationProposalId(curatedId);
    if (proposalId === null) continue;
    const proposal = proposalById.get(proposalId);
    if (!proposal) continue;
    const published =
      typeof proposal.published_post_url === "string" ? proposal.published_post_url.trim() : "";
    if (!published) continue;
    orderedEntries.push({ kind: "proposal", curatedId, proposal, sourceUrl: published });
  }

  if (orderedEntries.length === 0) return null;

  const influencerIds = [
    ...new Set(
      orderedEntries.map((e) => {
        if (e.kind === "app") return e.app.influencer_id;
        if (e.kind === "proposal") return e.proposal.influencer_id;
        return null;
      })
    ),
  ].filter(Boolean);

  const infById = new Map<
    string,
    { display_name: string | null; profile_slug: string | null; avatar_url: string | null }
  >();

  try {
    const { data, error } = await admin
      .from("influencers")
      .select("id, display_name, profile_slug, avatar_url")
      .in("id", influencerIds);
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (typeof row.id === "string") {
          infById.set(row.id, {
            display_name: row.display_name,
            profile_slug: row.profile_slug,
            avatar_url: row.avatar_url,
          });
        }
      }
    }
  } catch (error) {
    console.error("loadFeaturedCollaborations influencers", error);
  }

  const mediaByKey = new Map<string, ReturnType<typeof mediaFromRow>>();
  const sourceUrlByMediaKey = new Map<string, string>();
  try {
    const { data, error } = await admin
      .from("creator_media")
      .select(
        "influencer_id, source_url, kind, folder_path, play_path, av1_path, hevc_path, poster_path, duration_ms, width, height, status"
      )
      .in("influencer_id", influencerIds)
      .eq("status", "ready");
    if (error) {
      console.error("loadFeaturedCollaborations creator_media", error);
    } else if (Array.isArray(data)) {
      for (const row of data as MediaRow[]) {
        const hosted = mediaFromRow(row);
        if (!hosted) continue;
        const key = `${row.influencer_id}:${normalizeSourceUrl(row.source_url)}`;
        if (!mediaByKey.has(key)) {
          mediaByKey.set(key, hosted);
          sourceUrlByMediaKey.set(key, row.source_url);
        }
      }
    }
  } catch (error) {
    console.error("loadFeaturedCollaborations creator_media", error);
  }

  const viewsSetting = await getHomepageFeaturedCollaborationViewsSetting();
  const storedViewItems = viewsSetting?.items;

  const cards: FeaturedCollaborationCard[] = [];
  let uploadBrandName = "Brand";
  let uploadBrandLogoUrl: string | null = null;
  if (uploadKeys.length > 0 && setting.brandId) {
    try {
      const { data } = await admin
        .from("brands")
        .select("brand_name, logo_url")
        .eq("id", setting.brandId)
        .maybeSingle();
      if (typeof data?.brand_name === "string" && data.brand_name.trim()) {
        uploadBrandName = data.brand_name.trim();
      }
      if (typeof data?.logo_url === "string" && data.logo_url.trim()) {
        uploadBrandLogoUrl = data.logo_url.trim();
      }
    } catch {
      /* optional */
    }
  }

  for (const entry of orderedEntries) {
    if (entry.kind === "upload") {
      cards.push({
        applicationId: entry.curatedId,
        influencerName: uploadBrandName,
        influencerProfileHref: "/collaborations",
        influencerAvatarUrl: uploadBrandLogoUrl,
        playUrl: entry.hosted.playUrl,
        posterUrl: entry.hosted.posterUrl,
        sourcePostUrl: entry.sourceUrl,
        hostedMedia: entry.hosted,
        platform: null,
        publicViews: publicViewsForCuratedId(entry.curatedId, storedViewItems),
      });
      continue;
    }

    const influencerId =
      entry.kind === "app" ? entry.app.influencer_id : entry.proposal.influencer_id;
    const norm = normalizeSourceUrl(entry.sourceUrl);
    const media = mediaByKey.get(`${influencerId}:${norm}`);
    if (!media?.playUrl) continue;
    const inf = infById.get(influencerId);
    const displayName = (inf?.display_name || "").trim();
    if (!displayName) continue;
    const mediaKey = `${influencerId}:${norm}`;
    cards.push({
      applicationId: entry.curatedId,
      influencerName: displayName,
      influencerProfileHref: publicProfilePath(inf?.profile_slug ?? null, influencerId),
      influencerAvatarUrl:
        typeof inf?.avatar_url === "string" && inf.avatar_url.trim()
          ? inf.avatar_url.trim()
          : null,
      playUrl: media.playUrl,
      posterUrl: media.posterUrl,
      sourcePostUrl: entry.sourceUrl,
      hostedMedia: media,
      platform: featuredCollaborationPlatform(
        entry.sourceUrl,
        sourceUrlByMediaKey.get(mediaKey)
      ),
      publicViews: publicViewsForCuratedId(entry.curatedId, storedViewItems),
    });
  }

  if (cards.length === 0) return null;

  const firstAppEntry = orderedEntries.find((e) => e.kind === "app");
  const brandInfo = firstAppEntry
    ? campaignBrandFromRow(firstAppEntry.app)
    : { brandName: "Brand", brandLogoUrl: null, coverUrl: null };

  let brandName = brandInfo.brandName;
  let brandLogoUrl = brandInfo.brandLogoUrl;
  let decorativeCoverUrl = brandInfo.coverUrl;

  if (setting.brandId) {
    try {
      const { data, error } = await admin
        .from("brands")
        .select("brand_name, logo_url")
        .eq("id", setting.brandId)
        .maybeSingle();
      if (!error && data) {
        if (typeof data.brand_name === "string" && data.brand_name.trim()) {
          brandName = data.brand_name.trim();
        }
        if (typeof data.logo_url === "string" && data.logo_url.trim()) {
          brandLogoUrl = data.logo_url.trim();
        }
      }
    } catch (error) {
      console.error("loadFeaturedCollaborations brand", error);
    }
  }

  const heroPreferred = cards.find((c) => c.applicationId === setting.heroApplicationId);
  const initialHeroApplicationId = heroPreferred?.applicationId ?? cards[0].applicationId;

  const defaults = DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS;
  if (!decorativeCoverUrl && setting.brandId === defaults.brandId) {
    decorativeCoverUrl =
      "https://api.influo.gr/storage/v1/object/public/campaign-covers/4d7f24f5-fa4d-4601-bc6a-6a7da8331d49/1793732424284-gz6aia.webp";
  }

  const totalViews = featuredCollaborationViewsTotal(setting.applicationIds, viewsSetting);
  const decorativePhotoUrl =
    (await getHomepageBrandCtaDecorativePhotoSetting()) ||
    DEFAULT_HOMEPAGE_BRAND_CTA_DECORATIVE_PHOTO;

  return {
    brandName,
    brandLogoUrl,
    decorativeCoverUrl,
    decorativePhotoUrl,
    cards,
    initialHeroApplicationId,
    totalViews,
  };
}