import { supabaseService } from "@/lib/apiAuth";
import { mediaFromRow, normalizeSourceUrl } from "@/lib/creatorMedia";
import {
  featuredCollaborationPlatform,
  type FeaturedCollaborationPlatform,
} from "@/lib/featuredCollaborationPlatform";
import {
  DEFAULT_HOMEPAGE_FEATURED_COLLABORATIONS,
  type HomepageFeaturedCollaborationsConfig,
} from "@/lib/homepageFeaturedCollaborations";
import { publicProfilePath } from "@/lib/profileSlug";
import { featuredCollaborationViewsTotal } from "@/lib/homepageFeaturedCollaborationViews";
import {
  getHomepageFeaturedCollaborationViewsSetting,
  getHomepageFeaturedCollaborationsSetting,
} from "@/lib/siteSettingsServer";

export type { FeaturedCollaborationPlatform } from "@/lib/featuredCollaborationPlatform";

export type FeaturedCollaborationCard = {
  applicationId: string;
  influencerName: string;
  influencerProfileHref: string;
  influencerAvatarUrl: string | null;
  playUrl: string;
  posterUrl: string | null;
  platform: FeaturedCollaborationPlatform | null;
};

export type FeaturedCollaborationsShowcaseData = {
  brandName: string;
  brandLogoUrl: string | null;
  decorativeCoverUrl: string | null;
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

export async function loadFeaturedCollaborations(
  config?: HomepageFeaturedCollaborationsConfig
): Promise<FeaturedCollaborationsShowcaseData | null> {
  const setting = config ?? (await getHomepageFeaturedCollaborationsSetting());
  const applicationIds = [...new Set(setting.applicationIds)].filter(Boolean);
  if (applicationIds.length === 0) return null;

  const admin = supabaseService();
  const APP_COLS =
    "id, influencer_id, deliverable_url, brand_campaigns!inner ( cover_url, brand_id, brands ( brand_name, logo_url ) )";

  let apps: AppRow[] = [];
  try {
    const { data, error } = await admin
      .from("campaign_applications")
      .select(APP_COLS)
      .in("id", applicationIds);
    if (error) {
      const legacy = "id, influencer_id, deliverable_url, brand_campaigns!inner ( brand_id, brands ( brand_name, logo_url ) )";
      const second = await admin.from("campaign_applications").select(legacy).in("id", applicationIds);
      if (second.error) {
        console.error("loadFeaturedCollaborations applications", second.error);
        return null;
      }
      apps = (second.data || []) as AppRow[];
    } else {
      apps = (data || []) as AppRow[];
    }
  } catch (error) {
    console.error("loadFeaturedCollaborations applications", error);
    return null;
  }

  const appById = new Map<string, AppRow>();
  for (const row of apps) {
    if (typeof row.id === "string") appById.set(row.id, row);
  }

  const orderedApps = applicationIds
    .map((id) => appById.get(id))
    .filter((row): row is AppRow => !!row);

  if (orderedApps.length === 0) return null;

  const influencerIds = [...new Set(orderedApps.map((a) => a.influencer_id).filter(Boolean))];
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

  const cards: FeaturedCollaborationCard[] = [];
  for (const app of orderedApps) {
    const deliverable =
      typeof app.deliverable_url === "string" ? app.deliverable_url.trim() : "";
    if (!deliverable) continue;
    const norm = normalizeSourceUrl(deliverable);
    const media = mediaByKey.get(`${app.influencer_id}:${norm}`);
    if (!media?.playUrl) continue;
    const inf = infById.get(app.influencer_id);
    const displayName = (inf?.display_name || "").trim();
    if (!displayName) continue;
    const mediaKey = `${app.influencer_id}:${norm}`;
    cards.push({
      applicationId: app.id,
      influencerName: displayName,
      influencerProfileHref: publicProfilePath(inf?.profile_slug ?? null, app.influencer_id),
      influencerAvatarUrl:
        typeof inf?.avatar_url === "string" && inf.avatar_url.trim()
          ? inf.avatar_url.trim()
          : null,
      playUrl: media.playUrl,
      posterUrl: media.posterUrl,
      platform: featuredCollaborationPlatform(deliverable, sourceUrlByMediaKey.get(mediaKey)),
    });
  }

  if (cards.length === 0) return null;

  const firstApp = orderedApps[0];
  const brandInfo = firstApp ? campaignBrandFromRow(firstApp) : campaignBrandFromRow(orderedApps[0]);

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

  const viewsSetting = await getHomepageFeaturedCollaborationViewsSetting();
  const totalViews = featuredCollaborationViewsTotal(setting.applicationIds, viewsSetting);

  return {
    brandName,
    brandLogoUrl,
    decorativeCoverUrl,
    cards,
    initialHeroApplicationId,
    totalViews,
  };
}