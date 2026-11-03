import { NextRequest, NextResponse } from "next/server";
import { isAdminUser, supabaseService, userFromBearer } from "@/lib/apiAuth";
import { getBadges } from "@/lib/badges";
import { canonicalPlatform, parseFollowerNumber } from "@/lib/platformStats";

export const dynamic = "force-dynamic";

/** Public-safe subset of a social account. */
function publicAccounts(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a) => a && typeof a === "object" && !(a as { is_private?: boolean }).is_private)
    .map((a) => {
      const r = a as Record<string, unknown>;
      return {
        platform: String(r.platform || ""),
        username: String(r.username || "").replace(/^@/, ""),
        followers: r.followers ?? null,
        engagement_rate: r.engagement_rate ?? null,
        url: typeof r.url === "string" ? r.url : null,
      };
    })
    .filter((a) => a.platform && a.username);
}

/**
 * Applicant public profiles for one campaign, for its brand (or admin).
 * The browser role cannot read `influencers`, so the dashboard embed came back empty.
 * Returns only fields that are already public on the creator's profile page.
 */
export async function GET(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaignId = new URL(request.url).searchParams.get("campaignId")?.trim();
  if (!campaignId || !/^[0-9a-f-]{36}$/i.test(campaignId)) return NextResponse.json({ error: "campaignId" }, { status: 400 });

  const admin = supabaseService();
  const { data: campaign } = await admin.from("brand_campaigns").select("id, brand_id").eq("id", campaignId).maybeSingle();
  if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (String(campaign.brand_id) !== user.id && !(await isAdminUser(user))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: apps } = await admin.from("campaign_applications").select("influencer_id").eq("campaign_id", campaignId);
  const ids = [...new Set((apps || []).map((a) => String(a.influencer_id)).filter(Boolean))].slice(0, 300);
  if (!ids.length) return NextResponse.json({ profiles: {} });

  const [{ data: rows }, { data: props }] = await Promise.all([
    admin
      .from("influencers")
      .select("id, display_name, avatar_url, profile_slug, category, accounts, engagement_rate, location, verified, analytics_verified, created_at, avg_rating, total_reviews, min_rate, videos, hidden_videos")
      .in("id", ids),
    admin.from("proposals").select("influencer_id, status, brand_name, brand_added_to_past_brands").in("influencer_id", ids).eq("status", "completed"),
  ]);

  const done = new Map<string, { count: number; brands: Set<string> }>();
  for (const p of props || []) {
    const key = String(p.influencer_id);
    const entry = done.get(key) || { count: 0, brands: new Set<string>() };
    entry.count += 1;
    if (p.brand_added_to_past_brands && p.brand_name) entry.brands.add(String(p.brand_name).trim());
    done.set(key, entry);
  }

  const profiles: Record<string, unknown> = {};
  for (const r of rows || []) {
    const hidden = new Set(Array.isArray(r.hidden_videos) ? r.hidden_videos.map(String) : []);
    const videos = (Array.isArray(r.videos) ? r.videos : []).map(String).filter((v) => /^https:\/\//.test(v) && !hidden.has(v)).slice(0, 3);
    const d = done.get(String(r.id));
    // Same badge rules as the public profile (lib/badges).
    const followersObj: Record<string, number> = {};
    const erObj: Record<string, string> = {};
    for (const a of Array.isArray(r.accounts) ? (r.accounts as Array<Record<string, unknown>>) : []) {
      const plat = canonicalPlatform(a?.platform);
      if (!plat) continue;
      followersObj[plat] = Math.round(parseFollowerNumber(a.followers));
      if (a.engagement_rate) erObj[plat] = String(a.engagement_rate);
    }
    const created = r.created_at ? Date.parse(String(r.created_at)) : NaN;
    const badges = getBadges(
      {
        verified: Boolean(r.analytics_verified),
        followers: followersObj,
        engagement_rate: Object.keys(erObj).length ? erObj : r.engagement_rate || undefined,
        total_reviews: Number(r.total_reviews) || 0,
        avg_rating: r.avg_rating != null ? Number(r.avg_rating) : 0,
        past_brands: d ? [...d.brands] : [],
        account_created_days: Number.isFinite(created) ? Math.max(0, Math.floor((Date.now() - created) / 86400000)) : undefined,
        min_rate: r.min_rate || undefined,
      },
      "el"
    );
    profiles[String(r.id)] = {
      display_name: r.display_name,
      avatar_url: r.avatar_url,
      profile_slug: r.profile_slug,
      categories: String(r.category || "").split(",").map((c) => c.trim()).filter(Boolean).slice(0, 3),
      category: r.category,
      accounts: publicAccounts(r.accounts),
      engagement_rate: r.engagement_rate,
      location: r.location,
      verified: Boolean(r.verified),
      avg_rating: r.avg_rating != null ? Number(r.avg_rating) : null,
      total_reviews: Number(r.total_reviews) || 0,
      min_rate: r.min_rate ?? null,
      videos,
      completed: d?.count || 0,
      past_brands: d ? [...d.brands].slice(0, 6) : [],
      badges,
    };
  }
  return NextResponse.json({ profiles });
}
