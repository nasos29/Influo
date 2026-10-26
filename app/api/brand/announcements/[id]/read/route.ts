import { NextRequest, NextResponse } from "next/server";
import { resolveBrandIdForUser } from "@/lib/brandProfile";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: announcementId } = await params;
    const user = await userFromBearer(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseService();
    const brandId = await resolveBrandIdForUser(admin, user);
    if (!brandId) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const { data: announcement, error: annError } = await admin
      .from("announcements")
      .select("id, target_type, target_brand_id")
      .eq("id", announcementId)
      .maybeSingle();

    if (annError) {
      console.error("[brand announcements read]", annError);
      return NextResponse.json({ error: annError.message }, { status: 500 });
    }
    if (!announcement) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const allowed =
      announcement.target_type === "all_brands" ||
      (announcement.target_type === "specific_brand" &&
        String(announcement.target_brand_id) === brandId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await admin.from("announcement_brand_reads").upsert(
      {
        announcement_id: announcementId,
        brand_id: brandId,
        read_at: new Date().toISOString(),
      },
      { onConflict: "announcement_id,brand_id" }
    );

    if (error) {
      console.error("[brand announcements read]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[brand announcements read]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
