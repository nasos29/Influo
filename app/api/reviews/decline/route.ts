import { NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { applyReviewDecline } from "@/lib/applyReviewDecline";
import { loadChatActor } from "@/lib/chatActor";
import { parseReviewDeclineToken } from "@/lib/reviewInvite";

export const runtime = "nodejs";

/**
 * POST { t } — one-click decline from email (no auth required; signed token).
 * Also accepts Authorization + { proposalId, party } from the dashboard.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const admin = supabaseService();

    const token = typeof body.t === "string" ? body.t : "";
    if (token) {
      const payload = parseReviewDeclineToken(token);
      if (!payload) {
        return NextResponse.json(
          { error: "Ο σύνδεσμος δεν είναι έγκυρος." },
          { status: 400 }
        );
      }
      const result = await applyReviewDecline(admin, payload);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.message || result.reason },
          { status: result.reason === "not_found" ? 404 : 500 }
        );
      }
      return NextResponse.json({ ok: true, party: result.party, id: result.id });
    }

    const user = await userFromBearer(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const source = body.source === "campaign" ? "campaign" : "proposal";
    const collabId = String(body.applicationId || body.proposalId || "").trim();
    const party = body.party === "brand" || body.party === "influencer" ? body.party : null;
    if (!collabId || !party) {
      return NextResponse.json({ error: "proposalId and party required" }, { status: 400 });
    }

    const actor = await loadChatActor(user);

    if (source === "campaign") {
      const { data: application } = await admin
        .from("campaign_applications")
        .select("id, influencer_id, brand_campaigns ( brand_id, brands ( contact_email ) )")
        .eq("id", collabId)
        .maybeSingle();
      if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const campaignRaw = application.brand_campaigns as
        | { brand_id?: string; brands?: { contact_email?: string } | Array<{ contact_email?: string }> }
        | Array<{ brand_id?: string; brands?: { contact_email?: string } }>
        | null;
      const campaign = Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw;
      const brandRaw = campaign?.brands;
      const brand = Array.isArray(brandRaw) ? brandRaw[0] : brandRaw;
      const brandEmail = (brand?.contact_email || "").trim().toLowerCase();
      if (party === "brand") {
        const email = (actor.brandEmail || "").trim().toLowerCase();
        const idOk = actor.brandId && campaign?.brand_id && String(actor.brandId) === String(campaign.brand_id);
        if (!idOk && !(email && email === brandEmail)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } else if (!actor.influencerId || String(actor.influencerId) !== String(application.influencer_id)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      const { data: proposal } = await admin
        .from("proposals")
        .select("id, brand_email, brand_id, influencer_id")
        .eq("id", collabId)
        .maybeSingle();
      if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (party === "brand") {
        const email = (actor.brandEmail || "").trim().toLowerCase();
        const propEmail = (proposal.brand_email || "").trim().toLowerCase();
        const ok =
          (actor.brandId && proposal.brand_id && String(actor.brandId) === String(proposal.brand_id)) ||
          (email && email === propEmail);
        if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      } else if (!actor.influencerId || String(actor.influencerId) !== String(proposal.influencer_id)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const result = await applyReviewDecline(admin, {
      kind: "decline",
      source,
      id: collabId,
      party,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.message || result.reason },
        { status: result.reason === "not_found" ? 404 : 500 }
      );
    }
    return NextResponse.json({ ok: true, party: result.party, id: result.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
