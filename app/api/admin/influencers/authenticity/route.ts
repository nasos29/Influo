import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin, supabaseService } from "@/lib/apiAuth";
import { computeAudienceAuthenticity, type AudienceAuthenticity } from "@/lib/audienceAuthenticity";

export const dynamic = "force-dynamic";

export type AuthenticityMap = Record<string, AudienceAuthenticity>;

/** Admin: audience authenticity scores for badges and counts (computed on the fly). */
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
  const byId = new Map<
    string,
    Array<{
      total_followers: number | null;
      snapshot_at: string;
      accounts?: Array<{ platform: string; username: string; followers: number }> | null;
    }>
  >();
  for (const s of snaps || []) {
    const k = String(s.influencer_id);
    const arr = byId.get(k) || [];
    if (arr.length < 2) {
      arr.push({
        total_followers: s.total_followers,
        snapshot_at: s.snapshot_at,
        accounts: Array.isArray(s.accounts) ? s.accounts : null,
      });
    }
    byId.set(k, arr);
  }
  const map: AuthenticityMap = {};
  let suspicious = 0;
  let review = 0;
  for (const r of rows || []) {
    const auth = computeAudienceAuthenticity({
      accounts: r.accounts,
      snapshots: byId.get(String(r.id)),
    });
    map[String(r.id)] = auth;
    if (auth.status === "suspicious") suspicious += 1;
    else if (auth.status === "review") review += 1;
  }
  return NextResponse.json({ map, counts: { suspicious, review } });
}