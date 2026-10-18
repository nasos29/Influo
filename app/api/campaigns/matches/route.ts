import { NextRequest, NextResponse } from "next/server";
import { userFromBearer, supabaseService } from "@/lib/apiAuth";
import { recommendInfluencers, type InfluencerProfile } from "@/lib/recommendations";
import { parseStoredCategories } from "@/lib/categories";
import { statsFromAccounts, parseFollowerNumber } from "@/lib/platformStats";

export async function GET(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaignId = new URL(request.url).searchParams.get("campaignId") || "";
  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });

  const admin = supabaseService();
  const { data: campaign } = await admin
    .from("brand_campaigns")
    .select("id, brand_id, title, category, status, budget, location, min_followers, platforms")
    .eq("id", campaignId)
    .maybeSingle();
  if (!campaign || campaign.brand_id !== user.id) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  if (campaign.status !== "open") {
    return NextResponse.json({ matches: [] });
  }

  const { data: brand } = await admin.from("brands").select("industry, brand_name").eq("id", user.id).maybeSingle();
  const { data: rows } = await admin
    .from("influencers")
    .select("id, display_name, category, accounts, avatar_url, profile_slug, location, engagement_rate, analytics_verified, verified, approved")
    .eq("approved", true)
    .limit(200);

  const minFollowers = Number(campaign.min_followers) || 0;
  const area = String(campaign.location || "").trim().toLowerCase();
  const profiles: InfluencerProfile[] = (rows || [])
    .filter((row) => {
      const stats = statsFromAccounts(row.accounts);
      const max = stats.reduce((n, s) => Math.max(n, parseFollowerNumber(s.followers)), 0);
      if (minFollowers > 0 && max < minFollowers) return false;
      if (area && row.location && !String(row.location).toLowerCase().includes(area) && !area.includes(String(row.location).toLowerCase())) {
        return false;
      }
      return true;
    })
    .map((row) => {
      const parsed = parseStoredCategories(row.category);
      return {
        id: row.id,
        display_name: row.display_name || "Creator",
        category: parsed[0] || row.category,
        categories: parsed,
        location: row.location,
        accounts: row.accounts,
        avatar_url: row.avatar_url,
        profile_slug: row.profile_slug,
        engagement_rate: row.engagement_rate,
        verified: !!(row.analytics_verified || row.verified),
      };
    });

  const matches = recommendInfluencers(
    {
      id: user.id,
      brand_name: brand?.brand_name || "Brand",
      industry: campaign.category || brand?.industry || null,
      category: campaign.category || brand?.industry || null,
      contact_email: user.email || "",
      location: campaign.location || null,
    },
    profiles,
    { limit: 5, minScore: 20, lang: "el" }
  );

  return NextResponse.json({
    matches: matches.map((match) => ({
      id: match.influencer.id,
      display_name: match.influencer.display_name,
      avatar_url: match.influencer.avatar_url || null,
      profile_slug: match.influencer.profile_slug || null,
      categories: match.influencer.categories || [],
      accounts: match.influencer.accounts || [],
      score: match.score,
      reasons: match.reasons.slice(0, 2),
    })),
  });
}
