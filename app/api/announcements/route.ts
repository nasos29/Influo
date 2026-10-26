import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";

export async function GET(request: NextRequest) {
  try {
    const user = await userFromBearer(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = supabaseService();

    // Announcements visible to this influencer (all or targeted to them)
    const { data: announcements, error: annError } = await admin
      .from("announcements")
      .select("id, title, body, created_at, target_type")
      .or(`target_type.eq.all,target_influencer_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (annError) {
      console.error("[announcements GET]", annError);
      return NextResponse.json({ error: annError.message }, { status: 500 });
    }

    const { data: reads } = await admin
      .from("announcement_reads")
      .select("announcement_id, read_at, dismissed_at")
      .eq("influencer_id", user.id);

    const readSet = new Set((reads || []).map((r: { announcement_id: string }) => r.announcement_id));
    const readAtMap: Record<string, string> = {};
    const dismissedSet = new Set<string>();
    (reads || []).forEach((r: { announcement_id: string; read_at: string; dismissed_at: string | null }) => {
      readAtMap[r.announcement_id] = r.read_at;
      if (r.dismissed_at) dismissedSet.add(r.announcement_id);
    });

    const list = (announcements || [])
      .filter((a: { id: string }) => !dismissedSet.has(a.id))
      .map((a: { id: string; title: string; body: string; created_at: string; target_type: string }) => ({
        ...a,
        read: readSet.has(a.id),
        read_at: readAtMap[a.id] || null,
      }));

    return NextResponse.json({ data: list });
  } catch (err: unknown) {
    console.error("[announcements GET]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
