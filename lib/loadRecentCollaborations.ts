import { supabaseService } from "@/lib/apiAuth";
import { publicProfilePath } from "@/lib/profileSlug";
import { showcasePostFields } from "@/lib/showcasePostUrl";

export type RecentCollaborationCard = {
  id: string;
  source: "proposal" | "campaign";
  brandName: string;
  brandLogoUrl: string | null;
  influencerId: string;
  influencerName: string;
  influencerAvatarUrl: string | null;
  influencerProfileHref: string;
  category: string | null;
  completedAt: string | null;
  rating: number | null;
  postUrl: string | null;
  postProvider: "instagram" | "tiktok" | "youtube" | null;
  selfReportedViews: number | null;
  selfReportedReach: number | null;
  pinned: boolean;
};

export { showcasePostFields } from "@/lib/showcasePostUrl";

export type LoadRecentCollaborationsOptions = {
  /**
   * homepage: if any admin-pinned (showcase_admin_pinned) rows have a valid video,
   * return only those; otherwise fall back to latest with video.
   * listing: all eligible with video (pinned sort first). Used by /collaborations.
   */
  surface?: "homepage" | "listing";
};

const PROPOSAL_COLS =
  "id, brand_id, brand_name, influencer_id, service_type, agreement_accepted_at, published_post_url, published_post_pending_approval, self_reported_views, self_reported_reach, showcase_admin_pinned";

const APP_COLS =
  "id, influencer_id, deliverable_url, self_reported_views, self_reported_reach, showcase_admin_pinned, reviewed_at, delivered_at, brand_campaigns!inner ( id, title, category, brand_id, brands ( brand_name, logo_url ) )";

type InfRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  profile_slug: string | null;
  category: string | null;
  avg_rating: number | string | null;
};

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Public recent collaborations: dual consent, not admin-hidden, and a valid
 * video/post URL (proposals.published_post_url or campaign_applications.deliverable_url).
 * Completed without a video must never appear publicly.
 */
export async function loadRecentCollaborations(
  limit = 12,
  options: LoadRecentCollaborationsOptions = {}
): Promise<RecentCollaborationCard[]> {
  const surface = options.surface === "homepage" ? "homepage" : "listing";
  const take = Math.min(Math.max(1, Math.floor(limit)), 24);
  // Over-fetch: many completed rows lack a valid post URL and are dropped below.
  const fetchLimit = Math.min(Math.max(take * 4, 32), 80);
  const admin = supabaseService();

  type Candidate = {
    id: string;
    source: "proposal" | "campaign";
    brandName: string;
    brandLogoUrl: string | null;
    brandId: string | null;
    influencerId: string;
    category: string | null;
    completedAt: string | null;
    postUrlRaw: string | null;
    selfReportedViews: number | null;
    selfReportedReach: number | null;
    pinned: boolean;
    sortAt: number;
  };

  const candidates: Candidate[] = [];

  try {
    const PROPOSAL_COLS_LEGACY =
      "id, brand_id, brand_name, influencer_id, service_type, agreement_accepted_at, published_post_url, self_reported_views, self_reported_reach, showcase_admin_pinned";
    const first = await admin
      .from("proposals")
      .select(PROPOSAL_COLS)
      .eq("status", "completed")
      .eq("brand_showcase_consent", true)
      .eq("influencer_showcase_consent", true)
      .eq("showcase_admin_hidden", false)
      .not("published_post_url", "is", null)
      .order("showcase_admin_pinned", { ascending: false })
      .order("agreement_accepted_at", { ascending: false, nullsFirst: false })
      .limit(fetchLimit);
    let error = first.error;
    let rows: Record<string, unknown>[] = Array.isArray(first.data)
      ? (first.data as unknown as Record<string, unknown>[])
      : [];
    if (error && /published_post_pending_approval|PGRST204|42703/i.test(error.message || "")) {
      const second = await admin
        .from("proposals")
        .select(PROPOSAL_COLS_LEGACY)
        .eq("status", "completed")
        .eq("brand_showcase_consent", true)
        .eq("influencer_showcase_consent", true)
        .eq("showcase_admin_hidden", false)
        .not("published_post_url", "is", null)
        .order("showcase_admin_pinned", { ascending: false })
        .order("agreement_accepted_at", { ascending: false, nullsFirst: false })
        .limit(fetchLimit);
      error = second.error;
      rows = Array.isArray(second.data)
        ? (second.data as unknown as Record<string, unknown>[])
        : [];
    }
    if (error) {
      console.error("loadRecentCollaborations proposals", error);
    } else {
      for (const raw of rows) {
        const influencerId = typeof raw.influencer_id === "string" ? raw.influencer_id : "";
        if (!influencerId) continue;
        // Exclude creator-submitted links still awaiting brand approval (column may be missing pre-migration).
        if (raw.published_post_pending_approval === true) continue;
        const postUrlRaw =
          typeof raw.published_post_url === "string" ? raw.published_post_url.trim() : "";
        if (!postUrlRaw) continue;
        const completedAt =
          typeof raw.agreement_accepted_at === "string" ? raw.agreement_accepted_at : null;
        candidates.push({
          id: `proposal:${String(raw.id)}`,
          source: "proposal",
          brandName:
            (typeof raw.brand_name === "string" && raw.brand_name.trim()) || "Brand",
          brandLogoUrl: null,
          brandId: typeof raw.brand_id === "string" ? raw.brand_id : null,
          influencerId,
          category: typeof raw.service_type === "string" ? raw.service_type : null,
          completedAt,
          postUrlRaw,
          selfReportedViews: numOrNull(raw.self_reported_views),
          selfReportedReach: numOrNull(raw.self_reported_reach),
          pinned: !!raw.showcase_admin_pinned,
          sortAt: completedAt ? Date.parse(completedAt) || 0 : 0,
        });
      }
    }
  } catch (error) {
    console.error("loadRecentCollaborations proposals", error);
  }

  try {
    const { data, error } = await admin
      .from("campaign_applications")
      .select(APP_COLS)
      .eq("deliverable_status", "approved")
      .eq("brand_showcase_consent", true)
      .eq("influencer_showcase_consent", true)
      .eq("showcase_admin_hidden", false)
      .not("deliverable_url", "is", null)
      .order("showcase_admin_pinned", { ascending: false })
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .limit(fetchLimit);
    if (error) {
      // Schema may not have new columns yet locally — fail soft.
      console.error("loadRecentCollaborations campaigns", error);
    } else if (Array.isArray(data)) {
      for (const row of data) {
        const influencerId = typeof row.influencer_id === "string" ? row.influencer_id : "";
        if (!influencerId) continue;
        const postUrlRaw =
          typeof row.deliverable_url === "string" ? row.deliverable_url.trim() : "";
        if (!postUrlRaw) continue;
        const campaignRaw = row.brand_campaigns as unknown;
        const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as {
          title?: string | null;
          category?: string | null;
          brand_id?: string | null;
          brands?:
            | { brand_name?: string | null; logo_url?: string | null }
            | { brand_name?: string | null; logo_url?: string | null }[]
            | null;
        } | null;
        const brandRow = Array.isArray(campaign?.brands) ? campaign?.brands[0] : campaign?.brands;
        const completedAt =
          (typeof row.reviewed_at === "string" && row.reviewed_at) ||
          (typeof row.delivered_at === "string" && row.delivered_at) ||
          null;
        candidates.push({
          id: `campaign:${row.id}`,
          source: "campaign",
          brandName:
            (typeof brandRow?.brand_name === "string" && brandRow.brand_name.trim()) || "Brand",
          brandLogoUrl:
            typeof brandRow?.logo_url === "string" && brandRow.logo_url.trim()
              ? brandRow.logo_url.trim()
              : null,
          brandId: typeof campaign?.brand_id === "string" ? campaign.brand_id : null,
          influencerId,
          category:
            (typeof campaign?.category === "string" && campaign.category) ||
            (typeof campaign?.title === "string" && campaign.title) ||
            null,
          completedAt,
          postUrlRaw,
          selfReportedViews: numOrNull(row.self_reported_views),
          selfReportedReach: numOrNull(row.self_reported_reach),
          pinned: !!row.showcase_admin_pinned,
          sortAt: completedAt ? Date.parse(completedAt) || 0 : 0,
        });
      }
    }
  } catch (error) {
    console.error("loadRecentCollaborations campaigns", error);
  }

  // Drop invalid / non-social URLs before sorting (empty grey cards must never ship).
  const withVideo = candidates.filter((c) => showcasePostFields(c.postUrlRaw).postUrl);

  withVideo.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.sortAt - a.sortAt;
  });

  const pinnedWithVideo = withVideo.filter((c) => c.pinned);
  const pool =
    surface === "homepage" && pinnedWithVideo.length > 0 ? pinnedWithVideo : withVideo;
  const picked = pool.slice(0, take);
  if (picked.length === 0) return [];

  const influencerIds = [...new Set(picked.map((c) => c.influencerId))];
  const brandIds = [...new Set(picked.map((c) => c.brandId).filter(Boolean))] as string[];

  const infById = new Map<string, InfRow>();
  try {
    const { data, error } = await admin
      .from("influencers")
      .select("id, display_name, avatar_url, profile_slug, category, avg_rating")
      .in("id", influencerIds);
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (typeof row.id === "string") infById.set(row.id, row as InfRow);
      }
    }
  } catch (error) {
    console.error("loadRecentCollaborations influencers", error);
  }

  const logoByBrandId = new Map<string, string>();
  if (brandIds.length > 0) {
    try {
      const { data, error } = await admin
        .from("brands")
        .select("id, logo_url")
        .in("id", brandIds);
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          if (typeof row.id === "string" && typeof row.logo_url === "string" && row.logo_url.trim()) {
            logoByBrandId.set(row.id, row.logo_url.trim());
          }
        }
      }
    } catch (error) {
      console.error("loadRecentCollaborations brands", error);
    }
  }

  return picked.map((c) => {
    const inf = infById.get(c.influencerId);
    const { postUrl, postProvider } = showcasePostFields(c.postUrlRaw);
    const rating = numOrNull(inf?.avg_rating);
    return {
      id: c.id,
      source: c.source,
      brandName: c.brandName,
      brandLogoUrl: c.brandLogoUrl || (c.brandId ? logoByBrandId.get(c.brandId) || null : null),
      influencerId: c.influencerId,
      influencerName: (inf?.display_name || "").trim() || "Creator",
      influencerAvatarUrl:
        typeof inf?.avatar_url === "string" && inf.avatar_url.trim() ? inf.avatar_url.trim() : null,
      influencerProfileHref: publicProfilePath(inf?.profile_slug ?? null, c.influencerId),
      category: c.category || (typeof inf?.category === "string" ? inf.category : null),
      completedAt: c.completedAt,
      rating: rating != null && rating > 0 ? rating : null,
      postUrl,
      postProvider,
      selfReportedViews: c.selfReportedViews,
      selfReportedReach: c.selfReportedReach,
      pinned: c.pinned,
    };
  });
}
