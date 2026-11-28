import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { ownCampaignApplicationParty } from "@/lib/collabDeliverableAccess";
import { apiBodyString } from "@/lib/apiBodyString";
import { loadProposal, partyOf, requireActor } from "@/lib/proposalAccess";

type Source = "proposal" | "campaign";

const MAX = 200;

export const dynamic = "force-dynamic";

function cleanText(value: unknown, max = MAX): string | null {
  const t = String(value ?? "").trim().slice(0, max);
  return t || null;
}

export async function GET(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  const source: Source | null =
    sp.get("source") === "proposal" ? "proposal" : sp.get("source") === "campaign" ? "campaign" : null;
  const id = sp.get("id")?.trim() || "";
  if (!source || !id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const admin = supabaseService();
  if (source === "proposal") {
    const session = await requireActor(request);
    const proposal = await loadProposal(id);
    if (!session || !proposal || !partyOf(session.actor, proposal)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { data } = await admin
      .from("proposals")
      .select("collab_promo_code, collab_utm_link, collab_spark_ads_code")
      .eq("id", id)
      .maybeSingle();
    return NextResponse.json({ fields: data || {} });
  }

  const party = await ownCampaignApplicationParty(id, user.id, user.email || "");
  if (!party) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data } = await admin
    .from("campaign_applications")
    .select("collab_promo_code, collab_utm_link, collab_spark_ads_code")
    .eq("id", id)
    .maybeSingle();
  return NextResponse.json({ fields: data || {} });
}

export async function PATCH(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const source: Source | null =
    body.source === "proposal" ? "proposal" : body.source === "campaign" ? "campaign" : null;
  const id = apiBodyString(body.id).trim();
  if (!source || !id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const admin = supabaseService();
  const update: Record<string, string | null> = {};

  if (body.promoCode !== undefined) update.collab_promo_code = cleanText(body.promoCode);
  if (body.utmLink !== undefined) {
    const utm = cleanText(body.utmLink, 2000);
    if (utm && !utm.startsWith("https://")) {
      return NextResponse.json({ error: "utm_https_required" }, { status: 400 });
    }
    update.collab_utm_link = utm;
  }
  if (body.sparkAdsCode !== undefined) update.collab_spark_ads_code = cleanText(body.sparkAdsCode);
  if (!Object.keys(update).length) return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });

  if (source === "proposal") {
    const session = await requireActor(request);
    const proposal = await loadProposal(id);
    if (!session || !proposal) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const party = partyOf(session.actor, proposal);
    if (!party) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // Brand sets promo/utm; creator may paste spark code.
    if (party === "influencer" && ("collab_promo_code" in update || "collab_utm_link" in update)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { error } = await admin.from("proposals").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  const party = await ownCampaignApplicationParty(id, user.id, user.email || "");
  if (!party) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (party === "influencer" && ("collab_promo_code" in update || "collab_utm_link" in update)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { error } = await admin.from("campaign_applications").update(update).eq("id", id);
  if (error) {
    if (/collab_|schema cache/i.test(error.message || "")) {
      return NextResponse.json({ error: "migration_pending" }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}