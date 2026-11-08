import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin, supabaseService } from "@/lib/apiAuth";
import { creatorDataQualityFlags, type DataQualityFlag } from "@/lib/creatorDataQuality";

export const dynamic = "force-dynamic";

/** Admin: data-quality warnings for every creator, computed on the fly (no AI). */
export async function GET(request: NextRequest) {
  const denied = await rejectUnlessAdmin(request);
  if (denied) return denied;
  const admin = supabaseService();
  const { data: rows, error } = await admin.from("influencers").select("id, display_name, accounts").limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: snaps } = await admin
    .from("influencer_follower_snapshots")
    .select("influencer_id, total_followers, snapshot_at, accounts")
    .gte("snapshot_at", new Date(Date.now() - 120 * 86400_000).toISOString())
    .order("snapshot_at", { ascending: false })
    .limit(20000);
  const byId = new Map<string, Array<{ total_followers: number | null; snapshot_at: string; accounts?: Array<{ platform: string; username: string; followers: number }> | null }>>();
  for (const s of snaps || []) {
    const k = String(s.influencer_id);
    const arr = byId.get(k) || [];
    if (arr.length < 2) arr.push({ total_followers: s.total_followers, snapshot_at: s.snapshot_at, accounts: Array.isArray(s.accounts) ? s.accounts : null });
    byId.set(k, arr);
  }
  const flags: Record<string, { name: string; flags: DataQualityFlag[] }> = {};
  for (const r of rows || []) {
    const f = creatorDataQualityFlags(r.accounts, byId.get(String(r.id)));
    if (f.length) flags[String(r.id)] = { name: String(r.display_name || "").trim(), flags: f };
  }
  return NextResponse.json({ flags, count: Object.keys(flags).length });
}
