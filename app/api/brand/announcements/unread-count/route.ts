import { NextRequest, NextResponse } from "next/server";
import { resolveBrandIdForUser } from "@/lib/brandProfile";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";

export async function GET(request: NextRequest) {
  try {
    const user = await userFromBearer(request);
    if (!user) {
      return NextResponse.json({ count: 0 });
    }

    const admin = supabaseService();
    const brandId = await resolveBrandIdForUser(admin, user);
    if (!brandId) {
      return NextResponse.json({ count: 0 });
    }

    const { data: announcements } = await admin
      .from("announcements")
      .select("id")
      .or(`target_type.eq.all_brands,target_brand_id.eq.${brandId}`);

    const ids = (announcements || []).map((a: { id: string }) => a.id);
    if (ids.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    const { data: reads } = await admin
      .from("announcement_brand_reads")
      .select("announcement_id, dismissed_at")
      .eq("brand_id", brandId)
      .in("announcement_id", ids);

    const readOrDismissed = new Set(
      (reads || []).map((r: { announcement_id: string }) => r.announcement_id)
    );
    // Unread = visible announcements without a read row (dismissed rows also count as "handled").
    const unreadCount = ids.filter((id) => !readOrDismissed.has(id)).length;
    return NextResponse.json({ count: Math.max(0, unreadCount) });
  } catch (err: unknown) {
    console.error("[brand announcements unread-count]", err);
    return NextResponse.json({ count: 0 });
  }
}
