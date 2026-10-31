import { NextRequest, NextResponse } from "next/server";
import {
  isAdminUser,
  isBrandUser,
  supabaseService,
  userFromBearer,
} from "@/lib/apiAuth";
import { loadInfluencerRows } from "@/lib/loadPublicInfluencers";
import { COMMERCIAL_QUERY_COLUMNS, toCommercialInfluencer } from "@/lib/publicInfluencer";

/** True when the auth user owns this influencer row (id or auth_user_id). */
async function ownsInfluencer(userId: string, influencerId: string): Promise<boolean> {
  const admin = supabaseService();
  const { data, error } = await admin
    .from("influencers")
    .select("id, auth_user_id")
    .eq("id", influencerId)
    .maybeSingle();
  if (error || !data) return false;
  if (String(data.id) === userId) return true;
  if (data.auth_user_id != null && String(data.auth_user_id) === userId) return true;
  return false;
}

/**
 * Exact prices for approved influencers.
 * Allowed: logged-in brand, admin (same gate as /admin), or the creator viewing their own profile.
 * Never embed these in ISR/public HTML — clients fetch after auth.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await userFromBearer(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const brand = await isBrandUser(user);
    const admin = await isAdminUser(user);

    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim();
    const ids = (url.searchParams.get("ids") || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 200);

    if (!id && ids.length === 0) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    // Bulk (brand dashboard / campaigns): brand or admin only — not "owner of one".
    if (!id && ids.length > 0) {
      if (!brand && !admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { data, error } = await supabaseService()
        .from("influencers")
        .select(COMMERCIAL_QUERY_COLUMNS.join(","))
        .in("id", ids)
        .eq("approved", true);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const list = ((data || []) as unknown as Record<string, unknown>[]).map(toCommercialInfluencer);
      return NextResponse.json(
        { data: list },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const owner = !brand && !admin ? await ownsInfluencer(user.id, id!) : false;
    if (!brand && !admin && !owner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await loadInfluencerRows(COMMERCIAL_QUERY_COLUMNS, { id: id! });
    const row = rows[0];
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(
      { data: toCommercialInfluencer(row) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (err: unknown) {
    console.error("[API /api/influencers/commercial]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
