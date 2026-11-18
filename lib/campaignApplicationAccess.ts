import { NextResponse } from "next/server";
import { isAdminUser, supabaseService, userFromBearer } from "@/lib/apiAuth";
import { loadChatActor } from "@/lib/chatActor";
import type { CampaignDealCancelGate } from "@/lib/campaignDealCancelEligibility";

export type CampaignApplicationRow = CampaignDealCancelGate & {
  id: string;
  campaign_id: string;
  influencer_id: string;
  status: string;
  proposed_price?: number | null;
  cancel_reason?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  brand_campaigns?: {
    id?: string;
    title?: string | null;
    deadline?: string | null;
    brand_id?: string;
    brands?: { brand_name?: string | null; contact_email?: string | null } | Array<{
      brand_name?: string | null;
      contact_email?: string | null;
    }> | null;
  } | Array<{
    id?: string;
    title?: string | null;
    deadline?: string | null;
    brand_id?: string;
    brands?: { brand_name?: string | null; contact_email?: string | null } | null;
  }> | null;
};

const SELECT_FULL =
  "id, campaign_id, influencer_id, status, proposed_price, delivery_confirmed_at, auto_completed_at, deliverable_status, cancelled_by, cancel_reason, cancelled_at, brand_campaigns ( id, title, deadline, brand_id, brands ( brand_name, contact_email ) )";

function campaignMeta(row: CampaignApplicationRow): {
  brandId: string;
  brandName: string;
  brandEmail: string;
  campaignTitle: string;
  deadline: string | null;
} {
  const raw = row.brand_campaigns;
  const campaign = Array.isArray(raw) ? raw[0] : raw;
  const brandRaw = campaign?.brands;
  const brand = Array.isArray(brandRaw) ? brandRaw[0] : brandRaw;
  return {
    brandId: String(campaign?.brand_id || ""),
    brandName: brand?.brand_name || "Επιχείρηση",
    brandEmail: (brand?.contact_email || "").trim().toLowerCase(),
    campaignTitle: campaign?.title || "Καμπάνια",
    deadline: campaign?.deadline || null,
  };
}

export async function loadCampaignApplication(id: string): Promise<CampaignApplicationRow | null> {
  const admin = supabaseService();
  let res = await admin.from("campaign_applications").select(SELECT_FULL).eq("id", id).maybeSingle();
  if (res.error && /cancelled_|schema cache|column|PGRST204|42703/i.test(res.error.message || "")) {
    res = await admin
      .from("campaign_applications")
      .select(
        "id, campaign_id, influencer_id, status, proposed_price, delivery_confirmed_at, auto_completed_at, deliverable_status, brand_campaigns ( id, title, deadline, brand_id, brands ( brand_name, contact_email ) )"
      )
      .eq("id", id)
      .maybeSingle();
  }
  if (res.error || !res.data) return null;
  return res.data as CampaignApplicationRow;
}

export type CampaignCancelParty = "brand" | "influencer";

export type GuardCampaignCancelSuccess = {
  ok: true;
  party: CampaignCancelParty;
  application: CampaignApplicationRow;
  meta: ReturnType<typeof campaignMeta>;
};

export type GuardCampaignCancelFailure = NextResponse;

export async function guardCampaignApplicationCancel(
  request: Request,
  applicationId: unknown,
  preferredParty: CampaignCancelParty | null
): Promise<GuardCampaignCancelSuccess | GuardCampaignCancelFailure> {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = applicationId == null ? "" : String(applicationId).trim();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
  }

  const application = await loadCampaignApplication(id);
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  const meta = campaignMeta(application);
  const actor = await loadChatActor(user);

  let party: CampaignCancelParty | null = preferredParty;
  if (!party) {
    if (actor.influencerId && String(actor.influencerId) === String(application.influencer_id)) {
      party = "influencer";
    } else if (meta.brandId && user.id === meta.brandId) {
      party = "brand";
    } else if (meta.brandEmail && actor.brandEmail && meta.brandEmail === actor.brandEmail.trim().toLowerCase()) {
      party = "brand";
    }
  }

  if (!party) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (party === "influencer") {
    if (!actor.influencerId || String(actor.influencerId) !== String(application.influencer_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const owns =
      (meta.brandId && user.id === meta.brandId) ||
      (meta.brandEmail &&
        actor.brandEmail &&
        meta.brandEmail === actor.brandEmail.trim().toLowerCase());
    if (!owns && !(await isAdminUser(user))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return { ok: true, party, application, meta };
}

export function applicationMeta(row: CampaignApplicationRow) {
  return campaignMeta(row);
}