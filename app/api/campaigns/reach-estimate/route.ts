import { presenceAllows } from "@/lib/campaignAlert";
import { NextRequest, NextResponse } from "next/server";
import { userFromBearer, supabaseService } from "@/lib/apiAuth";
import { recommendInfluencers, type InfluencerProfile } from "@/lib/recommendations";
import { sanitizeSkills } from "@/lib/skills";
import { parseStoredCategories } from "@/lib/categories";
import { canonicalPlatform, parseFollowerNumber } from "@/lib/platformStats";

export const dynamic = "force-dynamic";

type Acc = { platform?: string; followers?: unknown; avg_views?: unknown; is_private?: boolean };

/** Avg views clamped for outliers: >5x followers -> 5x; <2% of followers -> 0 (use follower-based ratios). */
function cleanViews(followers: number, views: number): number {
  if (!views || !followers) return views;
  if (views < 0.02 * followers) return 0;
  return Math.min(views, 5 * followers);
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFollowerNumber(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Conservative unique-reach range for one creator, from public followers / average views.
 * Ratios are typical organic ranges per format (estimate, not a promise).
 */
/** Per creator: unique people (never above audience) and impressions (scale with deliverables). */
function creatorReach(accounts: Acc[], chips: Record<string, number>): { people: number; views: number } | null {
  const by = new Map<string, Acc>();
  for (const a of accounts) if (a && !a.is_private) by.set(canonicalPlatform(a.platform), a);
  // Impressions: each extra piece adds views with diminishing returns.
  const series = (base: number, n: number) => { let t = 0; for (let k = 0; k < n; k++) t += base * Math.pow(0.55, k); return t; };
  let views = 0;
  let people = 0;
  const platform = (aud: number, items: Array<[number, number]>) => {
    // items: [share of audience reached by one piece, count]; overlap -> 1 - Π(1-p)^n
    let miss = 1;
    for (const [p, n] of items) miss *= Math.pow(1 - Math.min(0.9, p), n);
    people += Math.min(aud, aud * (1 - miss));
  };
  const ig = by.get("instagram");
  if (ig && (chips.reel || chips.story || chips.post)) {
    const f = num(ig.followers);
    const v = cleanViews(num(ig.followers), num(ig.avg_views));
    const aud = Math.max(f, v);
    const reelShare = aud ? (v ? (0.7 * v) / aud : 0.2) : 0;
    if (chips.reel) views += series(v ? 0.7 * v : 0.2 * f, chips.reel);
    if (chips.story) views += series(0.05 * f, chips.story) * 0.6 + 0.05 * f * 0.4 * chips.story;
    if (chips.post) views += series(0.12 * f, chips.post) * 0.7 + 0.12 * f * 0.3 * chips.post;
    if (aud) platform(aud, [[reelShare, chips.reel], [0.05, chips.story], [0.12, chips.post]]);
  }
  for (const [chip, plat] of [["tiktok", "tiktok"], ["youtube", "youtube"]] as const) {
    const a = by.get(plat);
    if (!a || !chips[chip]) continue;
    const f = num(a.followers);
    const v = cleanViews(num(a.followers), num(a.avg_views));
    const aud = Math.max(f, v);
    views += series(v ? 0.7 * v : 0.1 * f, chips[chip]);
    if (aud) platform(aud, [[v ? (0.7 * v) / aud : 0.1, chips[chip]]]);
  }
  if (!views) return null;
  return { people, views: Math.max(views, people) };
}

function roundNice(n: number): number {
  if (n < 1000) return Math.round(n / 50) * 50;
  if (n < 100_000) return Math.round(n / 500) * 500;
  return Math.round(n / 5000) * 5000;
}

/** Reach estimate for a campaign draft, from the creators we would recommend for it. Nothing is saved. */
export async function POST(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const chipsIn = (body.chips && typeof body.chips === "object" ? body.chips : {}) as Record<string, unknown>;
  const chips: Record<string, number> = {};
  for (const k of ["reel", "story", "post", "tiktok", "youtube"]) chips[k] = Math.max(0, Math.min(50, Number(chipsIn[k]) || 0));
  if (!Object.values(chips).some(Boolean)) return NextResponse.json({ estimate: null, reason: "no_deliverables" });
  const slotsRaw = parseInt(String(body.slots || ""), 10);
  const creators = Math.max(1, Math.min(20, slotsRaw > 0 ? slotsRaw : 5));
  const minFollowers = Number(body.min_followers) || 0;
  const location = typeof body.location === "string" ? body.location : null;
  const requiresPresence = body.requires_presence === true;
  const category = typeof body.category === "string" ? body.category : null;

  const admin = supabaseService();
  const { data: brand } = await admin.from("brands").select("industry, brand_name").eq("id", user.id).maybeSingle();
  const { data: rows } = await admin
    .from("influencers")
    .select("id, display_name, category, accounts, avatar_url, profile_slug, location, engagement_rate, analytics_verified, verified, approved, skills")
    .eq("approved", true)
    .limit(400);

  const profiles: InfluencerProfile[] = (rows || [])
    .filter((row) => {
      const accs = Array.isArray(row.accounts) ? (row.accounts as Acc[]) : [];
      const max = accs.reduce((n, a) => Math.max(n, num(a?.followers)), 0);
      if (minFollowers > 0 && max < minFollowers) return false;
      if (!presenceAllows({ location, requiresPresence }, row.location)) return false;
      return creatorReach(accs, chips) != null;
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
        skills: sanitizeSkills(row.skills),
      };
    });

  const matches = recommendInfluencers(
    {
      id: user.id,
      brand_name: brand?.brand_name || "Brand",
      industry: category || brand?.industry || null,
      category: category || brand?.industry || null,
      contact_email: user.email || "",
      location,
      brief: [body.title, body.description, category].filter((v) => typeof v === "string" && v).join("\n"),
    },
    profiles,
    { limit: creators, minScore: 1, lang: "el" }
  );
  if (!matches.length) return NextResponse.json({ estimate: null, reason: "no_matches" });

  let people = 0;
  let views = 0;
  const list: Array<{ id: string; display_name: string; avatar_url: string | null; profile_slug: string | null; accounts: Array<{ platform: string; followers: number; avg_views: number }> }> = [];
  for (const m of matches) {
    const accs = (m.influencer.accounts as Acc[]) || [];
    const r = creatorReach(accs, chips);
    if (!r) continue;
    people += r.people;
    views += r.views;
    list.push({
      id: String(m.influencer.id),
      display_name: m.influencer.display_name,
      avatar_url: m.influencer.avatar_url || null,
      profile_slug: m.influencer.profile_slug || null,
      accounts: accs
        .filter((a) => a && !a.is_private && num(a.followers) > 0)
        .map((a) => ({ platform: canonicalPlatform(a.platform), followers: num(a.followers), avg_views: num(a.avg_views) > 5 * num(a.followers) || num(a.avg_views) < 0.02 * num(a.followers) ? 0 : num(a.avg_views) })),
    });
  }
  if (!views) return NextResponse.json({ estimate: null, reason: "no_data" });
  return NextResponse.json({
    estimate: {
      low: roundNice(0.8 * people),
      high: roundNice(1.2 * people),
      views_low: roundNice(0.8 * views),
      views_high: roundNice(1.2 * views),
      creators: list.length,
      list,
    },
  });
}
