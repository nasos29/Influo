import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const NOTE_MAX = 280;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function missingTable(err: { message?: string; code?: string } | null): boolean {
  const msg = (err?.message || "").toLowerCase();
  return err?.code === "42P01" || msg.includes("brand_shortlist");
}

async function getBrand(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return { error: "Unauthorized", status: 401 as const };
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { error: "Unauthorized", status: 401 as const };

  const email = (data.user.email || "").toLowerCase();
  const byId = await supabaseAdmin.from("brands").select("id").eq("id", data.user.id).maybeSingle();
  if (byId.data?.id) return { brandId: String(byId.data.id) };
  if (email) {
    const byEmail = await supabaseAdmin
      .from("brands")
      .select("id")
      .ilike("contact_email", email)
      .maybeSingle();
    if (byEmail.data?.id) return { brandId: String(byEmail.data.id) };
  }
  return { error: "Brand not found", status: 403 as const };
}

export async function GET(request: NextRequest) {
  const brand = await getBrand(request);
  if ("error" in brand) return NextResponse.json({ error: brand.error }, { status: brand.status });

  const { data: rows, error } = await supabaseAdmin
    .from("brand_shortlist")
    .select("influencer_id, note, created_at")
    .eq("brand_id", brand.brandId)
    .order("created_at", { ascending: false });

  if (error) {
    if (missingTable(error)) {
      return NextResponse.json({ error: "missing_table", items: [] }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (rows || []).map((r) => r.influencer_id);
  const infById = new Map<
    string,
    {
      display_name: string | null;
      avatar_url: string | null;
      category: string | null;
      min_rate: string | null;
      approved: boolean | null;
      profile_slug?: string | null;
      accounts?: Array<{ followers?: string; engagement_rate?: string }> | null;
      avg_response_time?: number | null;
      completion_rate?: number | null;
    }
  >();
  if (ids.length) {
    let infs: Array<Record<string, unknown>> | null = null;
    const full = await supabaseAdmin
      .from("influencers")
      .select(
        "id, display_name, avatar_url, category, min_rate, approved, profile_slug, accounts, avg_response_time, completion_rate"
      )
      .in("id", ids);
    if (full.error && /column/i.test(full.error.message)) {
      const fallback = await supabaseAdmin
        .from("influencers")
        .select("id, display_name, avatar_url, category, min_rate, approved, profile_slug, accounts")
        .in("id", ids);
      infs = (fallback.data as Array<Record<string, unknown>> | null) ?? null;
    } else {
      infs = (full.data as Array<Record<string, unknown>> | null) ?? null;
    }
    for (const inf of infs || []) {
      infById.set(String(inf.id), inf as (typeof infById extends Map<string, infer V> ? V : never));
    }
  }

  const { totalFollowersFromAccounts } = await import("@/lib/parseFollowers");
  const { parseErPercent } = await import("@/lib/engagementFlags");

  const items = (rows || []).map((r) => {
    const inf = infById.get(String(r.influencer_id));
    const accounts = Array.isArray(inf?.accounts) ? inf.accounts : [];
    const followers = totalFollowersFromAccounts(accounts);
    let engagementRate: number | null = null;
    for (const acc of accounts) {
      const er = parseErPercent(acc?.engagement_rate);
      if (er != null && er > 0) {
        engagementRate = engagementRate == null ? er : Math.max(engagementRate, er);
      }
    }
    return {
      influencerId: String(r.influencer_id),
      note: (r.note || "").toString(),
      createdAt: r.created_at,
      displayName: inf?.display_name || "Creator",
      avatarUrl: inf?.avatar_url || null,
      category: inf?.category || null,
      minRate: inf?.min_rate || null,
      approved: !!inf?.approved,
      profileSlug: inf?.profile_slug || null,
      followers: followers > 0 ? followers : null,
      engagementRate,
      avgResponseTime:
        typeof inf?.avg_response_time === "number" && inf.avg_response_time > 0
          ? inf.avg_response_time
          : null,
      completionRate:
        typeof inf?.completion_rate === "number" && inf.completion_rate > 0
          ? inf.completion_rate
          : null,
    };
  });

  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  const brand = await getBrand(request);
  if ("error" in brand) return NextResponse.json({ error: brand.error }, { status: brand.status });

  const body = await request.json().catch(() => ({}));
  const influencerId = String(body.influencerId || "").trim();
  if (!influencerId) return NextResponse.json({ error: "Missing influencerId" }, { status: 400 });

  const { data: inf } = await supabaseAdmin
    .from("influencers")
    .select("id, approved")
    .eq("id", influencerId)
    .maybeSingle();
  if (!inf) return NextResponse.json({ error: "Influencer not found" }, { status: 404 });
  if (!inf.approved) return NextResponse.json({ error: "Influencer is not approved" }, { status: 400 });

  const { error } = await supabaseAdmin.from("brand_shortlist").upsert(
    { brand_id: brand.brandId, influencer_id: influencerId, updated_at: new Date().toISOString() },
    { onConflict: "brand_id,influencer_id" }
  );
  if (error) {
    if (missingTable(error)) return NextResponse.json({ error: "missing_table" }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const brand = await getBrand(request);
  if ("error" in brand) return NextResponse.json({ error: brand.error }, { status: brand.status });

  const body = await request.json().catch(() => ({}));
  const influencerId = String(body.influencerId || "").trim();
  if (!influencerId) return NextResponse.json({ error: "Missing influencerId" }, { status: 400 });
  const note = String(body.note || "").trim().slice(0, NOTE_MAX);

  const { error } = await supabaseAdmin
    .from("brand_shortlist")
    .update({ note, updated_at: new Date().toISOString() })
    .eq("brand_id", brand.brandId)
    .eq("influencer_id", influencerId);

  if (error) {
    if (missingTable(error)) return NextResponse.json({ error: "missing_table" }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const brand = await getBrand(request);
  if ("error" in brand) return NextResponse.json({ error: brand.error }, { status: brand.status });

  const influencerId = String(request.nextUrl.searchParams.get("influencerId") || "").trim();
  if (!influencerId) return NextResponse.json({ error: "Missing influencerId" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("brand_shortlist")
    .delete()
    .eq("brand_id", brand.brandId)
    .eq("influencer_id", influencerId);

  if (error) {
    if (missingTable(error)) return NextResponse.json({ error: "missing_table" }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
