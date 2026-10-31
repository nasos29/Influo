import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { ilikePattern, pageBounds, parsePositiveInt, sevenDaysAgoIso } from "@/lib/adminPaging";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const BRAND_COLUMNS = [
  "id",
  "brand_name",
  "contact_email",
  "contact_person",
  "website",
  "industry",
  "afm",
  "logo_url",
  "verified",
  "created_at",
  "bio",
  "instagram",
  "city",
].join(",");

const BRAND_COLUMNS_CORE = [
  "id",
  "brand_name",
  "contact_email",
  "contact_person",
  "website",
  "industry",
  "afm",
  "logo_url",
  "verified",
  "created_at",
].join(",");

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = request.nextUrl;
    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      parsePositiveInt(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE)
    );
    const q = (url.searchParams.get("q") || "").trim();
    const status = (url.searchParams.get("status") || "all").toLowerCase();
    const since = sevenDaysAgoIso();
    const { from, to } = pageBounds(page, pageSize);

    let listQuery = supabaseAdmin
      .from("brands")
      .select(BRAND_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status === "verified") listQuery = listQuery.eq("verified", true);
    else if (status === "pending") listQuery = listQuery.or("verified.is.false,verified.is.null");

    if (q) {
      const pattern = ilikePattern(q);
      listQuery = listQuery.or(
        `brand_name.ilike.${pattern},contact_email.ilike.${pattern},contact_person.ilike.${pattern},afm.ilike.${pattern}`
      );
    }

    const [
      listResult,
      totalCount,
      pendingCount,
      verifiedCount,
      recentCount,
      attentionResult,
      pendingIdsResult,
    ] = await Promise.all([
      listQuery,
      supabaseAdmin.from("brands").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("brands").select("id", { count: "exact", head: true }).or("verified.is.false,verified.is.null"),
      supabaseAdmin.from("brands").select("id", { count: "exact", head: true }).eq("verified", true),
      supabaseAdmin.from("brands").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabaseAdmin
        .from("brands")
        .select("id, brand_name, contact_email, created_at")
        .or("verified.is.false,verified.is.null")
        .order("created_at", { ascending: false })
        .limit(5),
      supabaseAdmin
        .from("brands")
        .select("id")
        .or("verified.is.false,verified.is.null")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    let brands = listResult.data || [];
    let total = listResult.count ?? 0;
    if (listResult.error && /instagram|city|bio|column|schema cache/i.test(listResult.error.message)) {
      let fallbackQuery = supabaseAdmin
        .from("brands")
        .select(BRAND_COLUMNS_CORE, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (status === "verified") fallbackQuery = fallbackQuery.eq("verified", true);
      else if (status === "pending") fallbackQuery = fallbackQuery.or("verified.is.false,verified.is.null");
      if (q) {
        const pattern = ilikePattern(q);
        fallbackQuery = fallbackQuery.or(
          `brand_name.ilike.${pattern},contact_email.ilike.${pattern},contact_person.ilike.${pattern},afm.ilike.${pattern}`
        );
      }
      const fallback = await fallbackQuery;
      if (fallback.error) {
        return NextResponse.json(
          { error: "Failed to fetch brands", details: fallback.error.message },
          { status: 500 }
        );
      }
      brands = fallback.data || [];
      total = fallback.count ?? 0;
    } else if (listResult.error) {
      console.error("Error fetching brands:", listResult.error);
      return NextResponse.json(
        { error: "Failed to fetch brands", details: listResult.error.message },
        { status: 500 }
      );
    }

    const totalFiltered = total;
    return NextResponse.json(
      {
        success: true,
        brands,
        page,
        pageSize,
        total: totalFiltered,
        hasMore: page * pageSize < totalFiltered,
        counts: {
          total: totalCount.count ?? 0,
          pending: pendingCount.count ?? 0,
          verified: verifiedCount.count ?? 0,
          recent: recentCount.count ?? 0,
        },
        attention: attentionResult.data || [],
        pendingIds: (pendingIdsResult.data || []).map((row) => String(row.id)),
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Error in brands API:", error);
    return NextResponse.json({ error: "Internal server error", details: message }, { status: 500 });
  }
}
