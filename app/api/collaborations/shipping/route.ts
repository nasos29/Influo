import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { ownCampaignApplicationParty } from "@/lib/collabDeliverableAccess";
import { notifyShippingEvent } from "@/lib/collabShippingNotify";
import {
  canConfirmReceipt,
  canEditShippingAddress,
  canMarkShipped,
  shippingNeedsProduct,
} from "@/lib/shippingState";
import { deferAfterResponse } from "@/lib/proposalNotify";

type Action = "submit_address" | "mark_shipped" | "confirm_receipt";

export const dynamic = "force-dynamic";

async function loadApplication(applicationId: string) {
  const admin = supabaseService();
  const { data: app } = await admin
    .from("campaign_applications")
    .select(
      "id, influencer_id, status, brand_campaigns ( id, title, compensation_type, brand_id, brands ( brand_name, contact_email ) )"
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (!app || app.status !== "accepted") return null;
  const campaignRaw = app.brand_campaigns as unknown;
  const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as {
    id?: string;
    title?: string;
    compensation_type?: string;
    brand_id?: string;
    brands?: { brand_name?: string; contact_email?: string } | { brand_name?: string; contact_email?: string }[] | null;
  } | null;
  if (!campaign || !shippingNeedsProduct(campaign.compensation_type)) return null;
  const { data: shipping } = await admin
    .from("collaboration_shipping")
    .select("*")
    .eq("application_id", applicationId)
    .maybeSingle();
  return { admin, app, campaign, shipping };
}

export async function GET(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const applicationId = request.nextUrl.searchParams.get("applicationId")?.trim() || "";
  if (!applicationId) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const party = await ownCampaignApplicationParty(applicationId, user.id, user.email || "");
  if (!party) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const ctx = await loadApplication(applicationId);
  if (!ctx) return NextResponse.json({ error: "not_applicable" }, { status: 404 });
  return NextResponse.json({ shipping: ctx.shipping, party });
}

export async function POST(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const applicationId = String(body.applicationId || "").trim();
  const action = String(body.action || "").trim() as Action;
  if (!applicationId || !["submit_address", "mark_shipped", "confirm_receipt"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const party = await ownCampaignApplicationParty(applicationId, user.id, user.email || "");
  if (!party) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ctx = await loadApplication(applicationId);
  if (!ctx) return NextResponse.json({ error: "not_applicable" }, { status: 404 });

  const now = new Date().toISOString();

  if (action === "submit_address") {
    if (party !== "influencer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canEditShippingAddress(ctx.shipping)) {
      return NextResponse.json({ error: "address_locked" }, { status: 409 });
    }
    const row = {
      application_id: applicationId,
      recipient_name: String(body.recipientName || "").trim().slice(0, 120) || null,
      phone: String(body.phone || "").trim().slice(0, 40) || null,
      street: String(body.street || "").trim().slice(0, 200) || null,
      city: String(body.city || "").trim().slice(0, 80) || null,
      postal_code: String(body.postalCode || "").trim().slice(0, 20) || null,
      country: String(body.country || "GR").trim().slice(0, 2) || "GR",
      notes: String(body.notes || "").trim().slice(0, 500) || null,
      status: "address_submitted" as const,
      address_submitted_at: now,
      updated_at: now,
    };
    if (!row.street || !row.city || !row.postal_code || !row.recipient_name || !row.phone) {
      return NextResponse.json({ error: "address_incomplete" }, { status: 400 });
    }
    const { error } = await ctx.admin.from("collaboration_shipping").upsert(row, { onConflict: "application_id" });
    if (error) {
      if (/collaboration_shipping|schema cache/i.test(error.message || "")) {
        return NextResponse.json({ error: "migration_pending" }, { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    deferAfterResponse(() =>
      notifyShippingEvent({
        kind: "address_submitted",
        applicationId,
        influencerId: ctx.app.influencer_id,
        campaignTitle: ctx.campaign?.title,
        brandEmail: (Array.isArray(ctx.campaign?.brands) ? ctx.campaign?.brands[0] : ctx.campaign?.brands)?.contact_email,
      })
    );
    return NextResponse.json({ ok: true, status: "address_submitted" });
  }

  if (action === "mark_shipped") {
    if (party !== "brand") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canMarkShipped(ctx.shipping)) return NextResponse.json({ error: "invalid_state" }, { status: 409 });
    const courier = String(body.courier || "").trim().slice(0, 80);
    const trackingNumber = String(body.trackingNumber || "").trim().slice(0, 80);
    const trackingUrl = String(body.trackingUrl || "").trim().slice(0, 500);
    if (!courier || !trackingNumber) return NextResponse.json({ error: "tracking_required" }, { status: 400 });
  const { error } = await ctx.admin
      .from("collaboration_shipping")
      .update({
        status: "shipped",
        courier,
        tracking_number: trackingNumber,
        tracking_url: trackingUrl || null,
        shipped_at: now,
        updated_at: now,
      })
      .eq("application_id", applicationId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    deferAfterResponse(() =>
      notifyShippingEvent({
        kind: "shipped",
        applicationId,
        influencerId: ctx.app.influencer_id,
        campaignTitle: ctx.campaign?.title,
        courier,
        trackingNumber,
        trackingUrl: trackingUrl || null,
      })
    );
    return NextResponse.json({ ok: true, status: "shipped" });
  }

  if (action === "confirm_receipt") {
    if (party !== "influencer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canConfirmReceipt(ctx.shipping)) return NextResponse.json({ error: "invalid_state" }, { status: 409 });
    const { error } = await ctx.admin
      .from("collaboration_shipping")
      .update({ status: "received", received_at: now, updated_at: now })
      .eq("application_id", applicationId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    deferAfterResponse(() =>
      notifyShippingEvent({
        kind: "received",
        applicationId,
        influencerId: ctx.app.influencer_id,
        campaignTitle: ctx.campaign?.title,
        brandEmail: (Array.isArray(ctx.campaign?.brands) ? ctx.campaign?.brands[0] : ctx.campaign?.brands)?.contact_email,
      })
    );
    return NextResponse.json({ ok: true, status: "received" });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}