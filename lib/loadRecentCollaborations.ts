import { supabaseService } from "@/lib/apiAuth";
import { publicProfilePath } from "@/lib/profileSlug";
import { isAllowedTopPostUrl } from "@/lib/topPosts";
import { detectProvider } from "@/lib/videoThumbnail";

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

const PROPOSAL_COLS =
  "id, brand_id, brand_name, influencer_id, service_type, agreement_accepted_at, published_post_url, self_reported_views, self_reported_reach, showcase_admin_pinned";

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

function postFields(urlRaw: unknown): {
  postUrl: string | null;
  postProvider: RecentCollaborationCard["postProvider"];
} {
  const url = typeof urlRaw === "string" ? urlRaw.trim() : "";
  if (!url || !isAllowedTopPostUrl(url)) return { postUrl: null, postProvider: null };
  return { postUrl: url, postProvider: detectProvider(url) };
}

/**
 * Public recent collaborations: only rows with BOTH consents, not admin-hidden.
 * Narrow selects + batched influencer/brand lookups. Limit keeps egress small.
 */
export async function loadRecentCollaborations(limit = 12): Promise<RecentCollaborationCard[]> {
  const take = Math.min(Math.max(1, Math.floor(limit)), 24);
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
    const { data, error } = await admin
      .from("proposals")
      .select(PROPOSAL_COLS)
      .eq("status", "completed")
      .eq("brand_showcase_consent", true)
      .eq("influencer_showcase_consent", true)
      .eq("showcase_admin_hidden", false)
      .order("showcase_admin_pinned", { ascending: false })
      .order("agreement_accepted_at", { ascending: false, nullsFirst: false })
      .limit(take);
    if (error) {
      console.error("loadRecentCollaborations proposals", error);
    } else if (Array.isArray(data)) {
      for (const row of data) {
        const influencerId = typeof row.influencer_id === "string" ? row.influencer_id : "";
        if (!influencerId) continue;
        const completedAt =
          typeof row.agreement_accepted_at === "string" ? row.agreement_accepted_at : null;
        candidates.push({
          id: `proposal:${row.id}`,
          source: "proposal",
          brandName: (typeof row.brand_name === "string" && row.brand_name.trim()) || "Brand",
          brandLogoUrl: null,
          brandId: typeof row.brand_id === "string" ? row.brand_id : null,
          influencerId,
          category: typeof row.service_type === "string" ? row.service_type : null,
          completedAt,
          postUrlRaw: typeof row.published_post_url === "string" ? row.published_post_url : null,
          selfReportedViews: numOrNull(row.self_reported_views),
          selfReportedReach: numOrNull(row.self_reported_reach),
          pinned: !!row.showcase_admin_pinned,
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
      .order("showcase_admin_pinned", { ascending: false })
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .limit(take);
    if (error) {
      // Schema may not have new columns yet locally — fail soft.
      console.error("loadRecentCollaborations campaigns", error);
    } else if (Array.isArray(data)) {
      for (const row of data) {
        const influencerId = typeof row.influencer_id === "string" ? row.influencer_id : "";
        if (!influencerId) continue;
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
          postUrlRaw: typeof row.deliverable_url === "string" ? row.deliverable_url : null,
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

  candidates.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.sortAt - a.sortAt;
  });
  const picked = candidates.slice(0, take);
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
    const { postUrl, postProvider } = postFields(c.postUrlRaw);
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
