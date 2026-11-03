import { NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

/** Avatars of the caller's chat counterparties only (creator avatar_url / brand logo_url). */
export async function GET(request: Request) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = supabaseService();
  const email = (user.email || "").toLowerCase().trim();
  let q = admin.from("conversations").select("influencer_id, brand_email").limit(500);
  q = email ? q.or(`influencer_id.eq.${user.id},brand_email.ilike.${email.replace(/[,()]/g, "")}`) : q.eq("influencer_id", user.id);
  const { data: convs } = await q;
  const ids = [...new Set((convs || []).map((c) => c.influencer_id).filter(Boolean))];
  const emails = [...new Set((convs || []).map((c) => String(c.brand_email || "").toLowerCase()).filter(Boolean))];
  const influencers: Record<string, string> = {};
  const brands: Record<string, string> = {};
  if (ids.length) {
    const { data } = await admin.from("influencers").select("id, avatar_url").in("id", ids);
    for (const r of data || []) if (r.avatar_url) influencers[r.id] = r.avatar_url;
  }
  if (emails.length) {
    const { data } = await admin.from("brands").select("contact_email, logo_url").in("contact_email", emails);
    for (const r of data || []) if (r.logo_url) brands[String(r.contact_email).toLowerCase()] = r.logo_url;
    const missing = emails.filter((e) => !brands[e]);
    for (const e of missing.slice(0, 30)) {
      const { data: b } = await admin.from("brands").select("logo_url").ilike("contact_email", e).maybeSingle();
      if (b?.logo_url) brands[e] = b.logo_url;
    }
  }
  // Brand composing a first message: that creator's public avatar.
  let target: string | null = null;
  const want = new URL(request.url).searchParams.get("influencer");
  if (want && /^[0-9a-f-]{36}$/i.test(want)) {
    target = influencers[want] || null;
    if (!target) {
      const { data } = await admin.from("influencers").select("avatar_url").eq("id", want).maybeSingle();
      target = (data?.avatar_url as string | null) || null;
    }
  }
  return NextResponse.json({ influencers, brands, target }, { headers: { "Cache-Control": "private, max-age=300" } });
}
