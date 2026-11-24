import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin, supabaseService } from "@/lib/apiAuth";
import {
  BRAND_REVIEW_MARKER,
  CREATOR_TARGET_REVIEW_FILTER,
  isBrandTargetReview,
} from "@/lib/brandReview";
import { publicProfilePath } from "@/lib/profileSlug";

type ReviewRow = {
  id: string;
  influencer_id: string;
  brand_email: string;
  brand_name: string | null;
  rating: number;
  review_text: string | null;
  project_type: string | null;
  verified: boolean | null;
  created_at: string;
};

type ReviewDirection = "brand_to_creator" | "creator_to_brand";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 1000;

function normEmail(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function reviewDirection(projectType: string | null | undefined): ReviewDirection {
  return isBrandTargetReview(projectType) ? "creator_to_brand" : "brand_to_creator";
}

function avgRating(rows: { rating: number }[]): number | null {
  if (rows.length === 0) return null;
  const sum = rows.reduce((a, r) => a + Number(r.rating || 0), 0);
  return Math.round((sum / rows.length) * 100) / 100;
}

async function loadBrandsByEmail(emails: string[]) {
  const admin = supabaseService();
  const unique = [...new Set(emails.filter(Boolean))];
  const map = new Map<string, { id: string; brand_name: string | null }>();
  const chunkSize = 80;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data } = await admin
      .from("brands")
      .select("id, brand_name, contact_email")
      .in("contact_email", chunk);
    for (const row of data || []) {
      const key = normEmail(row.contact_email as string);
      if (!key) continue;
      map.set(key, {
        id: String(row.id),
        brand_name: (row.brand_name as string | null) || null,
      });
    }
    const missing = chunk.filter((e) => !map.has(e));
    for (const email of missing) {
      const { data: one } = await admin
        .from("brands")
        .select("id, brand_name, contact_email")
        .ilike("contact_email", email)
        .maybeSingle();
      if (one) {
        map.set(email, {
          id: String(one.id),
          brand_name: (one.brand_name as string | null) || null,
        });
      }
    }
  }
  return map;
}

async function enrichReviews(rows: ReviewRow[]) {
  const admin = supabaseService();
  const influencerIds = [...new Set(rows.map((r) => r.influencer_id))];
  const brandEmails = rows.map((r) => normEmail(r.brand_email));

  const [creatorsRes, brandMap] = await Promise.all([
    influencerIds.length
      ? admin.from("influencers").select("id, display_name, profile_slug").in("id", influencerIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null; profile_slug: string | null }[] }),
    loadBrandsByEmail(brandEmails),
  ]);

  const creatorMap = new Map(
    (creatorsRes.data || []).map((c) => [
      String(c.id),
      {
        display_name: (c.display_name as string | null) || "",
        profile_slug: (c.profile_slug as string | null) || null,
      },
    ])
  );

  return rows.map((row) => {
    const direction = reviewDirection(row.project_type);
    const creator = creatorMap.get(row.influencer_id);
    const creatorDisplay = creator?.display_name?.trim() || row.influencer_id;
    const emailKey = normEmail(row.brand_email);
    const brand = brandMap.get(emailKey);
    const brandDisplay =
      (row.brand_name && row.brand_name.trim()) ||
      brand?.brand_name?.trim() ||
      row.brand_email ||
      "—";

  const reviewer_name =
      direction === "brand_to_creator" ? brandDisplay : creatorDisplay;
    const reviewed_name =
      direction === "brand_to_creator" ? creatorDisplay : brandDisplay;

    const project_type_label =
      row.project_type && row.project_type !== BRAND_REVIEW_MARKER
        ? row.project_type
        : null;

    return {
      id: row.id,
      influencer_id: row.influencer_id,
      brand_email: row.brand_email,
      brand_name: row.brand_name,
      brand_id: brand?.id ?? null,
      rating: row.rating,
      review_text: row.review_text,
      project_type: row.project_type,
      project_type_label,
      verified: Boolean(row.verified),
      created_at: row.created_at,
      direction,
      reviewer_name,
      reviewed_name,
      creator_display_name: creatorDisplay,
      creator_profile_slug: creator?.profile_slug ?? null,
      creator_profile_path: publicProfilePath(creator?.profile_slug, row.influencer_id),
    };
  });
}

function matchesSearch(
  item: Awaited<ReturnType<typeof enrichReviews>>[number],
  q: string
): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const hay = [
    item.reviewer_name,
    item.reviewed_name,
    item.review_text || "",
    item.brand_name || "",
    item.brand_email,
    item.creator_display_name,
    item.project_type_label || "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

function buildSummary(rows: { rating: number; direction: ReviewDirection }[]) {
  const brandToCreator = rows.filter((r) => r.direction === "brand_to_creator");
  const creatorToBrand = rows.filter((r) => r.direction === "creator_to_brand");
  return {
    total: rows.length,
    average_rating: avgRating(rows),
    by_direction: {
      brand_to_creator: {
        count: brandToCreator.length,
        average_rating: avgRating(brandToCreator),
      },
      creator_to_brand: {
        count: creatorToBrand.length,
        average_rating: avgRating(creatorToBrand),
      },
    },
  };
}

export async function GET(req: NextRequest) {
  const denied = await rejectUnlessAdmin(req);
  if (denied) return denied;

  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") || "").trim();
  const directionParam = sp.get("direction") || "all";
  const ratingRaw = sp.get("rating");
  const limitRaw = Number(sp.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, limitRaw), MAX_LIMIT)
    : DEFAULT_LIMIT;

  let rating: number | null = null;
  if (ratingRaw != null && ratingRaw !== "") {
    const parsed = parseInt(ratingRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 5) {
      return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
    }
    rating = parsed;
  }

  const directionFilter: "all" | ReviewDirection =
    directionParam === "brand_to_creator" ||
    directionParam === "creator_to_brand" ||
    directionParam === "all"
      ? directionParam
      : "all";

  const admin = supabaseService();
  let query = admin
    .from("influencer_reviews")
    .select(
      "id, influencer_id, brand_email, brand_name, rating, review_text, project_type, verified, created_at"
    )
    .order("created_at", { ascending: false });

  if (directionFilter === "creator_to_brand") {
    query = query.eq("project_type", BRAND_REVIEW_MARKER);
  } else if (directionFilter === "brand_to_creator") {
    query = query.or(CREATOR_TARGET_REVIEW_FILTER);
  }

  if (rating != null && Number.isFinite(rating)) {
    query = query.eq("rating", rating);
  }

  const [{ data, error }, { count: totalAll, error: countError }] = await Promise.all([
    query.limit(MAX_LIMIT),
    admin.from("influencer_reviews").select("id", { count: "exact", head: true }),
  ]);

  if (error || countError) {
    const msg = error?.message || countError?.message || "Query failed";
    return NextResponse.json(
      { items: [], summary: buildSummary([]), total: 0, ids: [], error: msg },
      { status: 500 }
    );
  }

  const rows = (data || []) as ReviewRow[];
  let items = await enrichReviews(rows);

  if (q) {
    items = items.filter((item) => matchesSearch(item, q));
  }

  const summary = buildSummary(items);
  const sliced = items.slice(0, limit);
  const ids = items.map((item) => item.id);

  return NextResponse.json({
    items: sliced,
    summary,
    total: totalAll ?? summary.total,
    ids,
  });
}