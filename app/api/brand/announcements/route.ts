import { NextRequest, NextResponse } from "next/server";
import { resolveBrandIdForUser } from "@/lib/brandProfile";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";

export async function GET(request: NextRequest) {
  try {
    const user = await userFromBearer(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseService();
    const brandId = await resolveBrandIdForUser(admin, user);
    if (!brandId) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const announcementFilter = `target_type.eq.all_brands,target_brand_id.eq.${brandId}`;
    const withEnglish = await admin
      .from("announcements")
      .select("id, title, title_en, body, body_en, created_at, target_type")
      .or(announcementFilter)
      .order("created_at", { ascending: false });
    let announcements: Array<Record<string, unknown>> | null = (withEnglish.data as Array<Record<string, unknown>> | null) ?? null;
    let annError = withEnglish.error;
    if (annError && /column|schema cache|does not exist/i.test(annError.message)) {
      const plain = await admin
        .from("announcements")
        .select("id, title, body, created_at, target_type")
        .or(announcementFilter)
        .order("created_at", { ascending: false });
      announcements = (plain.data as Array<Record<string, unknown>> | null) ?? null;
      annError = plain.error;
    }

    if (annError) {
      console.error("[brand announcements GET]", annError);
      return NextResponse.json({ error: annError.message }, { status: 500 });
    }

    const { data: reads } = await admin
      .from("announcement_brand_reads")
      .select("announcement_id, read_at, dismissed_at")
      .eq("brand_id", brandId);

    const readSet = new Set((reads || []).map((r: { announcement_id: string }) => r.announcement_id));
    const readAtMap: Record<string, string> = {};
    const dismissedSet = new Set<string>();
    (reads || []).forEach(
      (r: { announcement_id: string; read_at: string; dismissed_at: string | null }) => {
        readAtMap[r.announcement_id] = r.read_at;
        if (r.dismissed_at) dismissedSet.add(r.announcement_id);
      }
    );

    const list = (announcements || [])
      .filter((a) => !dismissedSet.has(String(a.id)))
      .map((a) => ({
        id: String(a.id),
        title: typeof a.title === "string" ? a.title : "",
        title_en: typeof a.title_en === "string" ? a.title_en : null,
        body: typeof a.body === "string" ? a.body : "",
        body_en: typeof a.body_en === "string" ? a.body_en : null,
        created_at: typeof a.created_at === "string" ? a.created_at : "",
        target_type: typeof a.target_type === "string" ? a.target_type : "",
        read: readSet.has(String(a.id)),
        read_at: readAtMap[String(a.id)] || null,
      }));

    return NextResponse.json({ data: list });
  } catch (err: unknown) {
    console.error("[brand announcements GET]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
