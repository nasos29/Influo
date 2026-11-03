import { presenceAllows } from "@/lib/campaignAlert";
import { NextRequest, NextResponse } from "next/server";
import { userFromBearer, supabaseService } from "@/lib/apiAuth";
import { recommendInfluencers, type InfluencerProfile } from "@/lib/recommendations";
import { sanitizeSkills } from "@/lib/skills";
import { parseStoredCategories } from "@/lib/categories";
import { canonicalPlatform, parseFollowerNumber } from "@/lib/platformStats";

export const dynamic = "force-dynamic";

type Acc = { platform?: string; followers?: unknown; avg_views?: unknown; is_private?: boolean };

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFollowerNumber(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Conservative unique-reach range for one creator, from public followers / average views.
 * Ratios are typical organic ranges per format (estimate, not a promise).
 */
function creatorReach(accounts: Acc[], chips: Record<string, number>): [number, number] | null {
  const by = new Map<string, Acc>();
  for (const a of accounts) if (a && !a.is_private) by.set(canonicalPlatform(a.platform), a);
  const parts: Array<[number, number]> = [];
  let cap = 0;
  const ig = by.get("instagram");
  if (ig && (chips.reel || chips.story || chips.post)) {
    const f = num(ig.followers);
    const v = num(ig.avg_views);
    cap = Math.max(cap, f, v);
    if (chips.reel) parts.push(v ? [0.5 * v, 1.0 * v * Math.min(chips.reel, 3)] : [0.1 * f, 0.3 * f]);
    if (chips.story) parts.push([0.03 * f, 0.08 * f]);
    if (chips.post) parts.push([0.08 * f, 0.2 * f]);
  }
  for (const [chip, plat] of [["tiktok", "tiktok"], ["youtube", "youtube"]] as const) {
    const a = by.get(plat);
    if (!a || !chips[chip]) continue;
    const f = num(a.followers);
    const v = num(a.avg_views);
    cap = Math.max(cap, f, v);
    parts.push(v ? [0.5 * v, v * Math.min(chips[chip], 3)] : [0.05 * f, 0.15 * f]);
  }
  if (!parts.length || !cap) return null;
  const low = Math.max(...parts.map((p) => p[0]));
  const high = Math.min(parts.reduce((s, p) => s + p[1], 0), cap);
  return [low, Math.max(low, high)];
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

  let low = 0;
  let high = 0;
  for (const m of matches) {
    const r = creatorReach((m.influencer.accounts as Acc[]) || [], chips);
    if (!r) continue;
    low += r[0];
    high += r[1];
  }
  if (!high) return NextResponse.json({ estimate: null, reason: "no_data" });
  return NextResponse.json({ estimate: { low: roundNice(low), high: roundNice(high), creators: matches.length } });
}
