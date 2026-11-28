import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { ownCampaignApplicationParty } from "@/lib/collabDeliverableAccess";
import { campaignRequiresUgcDraft, proposalRequiresUgcDraft } from "@/lib/collaborationUgc";
import {
  canRequestDraftChanges,
  nextDraftRevisionCount,
} from "@/lib/deliverableRevisionLimits";
import { notifyDraftReview } from "@/lib/collabDraftNotify";
import { loadProposal, partyOf, requireActor } from "@/lib/proposalAccess";
import { apiBodyString } from "@/lib/apiBodyString";
import { deferAfterResponse } from "@/lib/proposalNotify";

type Source = "proposal" | "campaign";
type Action = "submit" | "approve" | "request_changes";

async function loadCollabRow(source: Source, id: string) {
  const admin = supabaseService();
  if (source === "proposal") {
    const { data } = await admin
      .from("proposals")
      .select(
        "id, influencer_id, service_type, selected_extras, message, status, deliverable_draft_upload_id, deliverable_draft_status, deliverable_draft_review_note, deliverable_draft_revision_count"
      )
      .eq("id", id)
      .maybeSingle();
    return { admin, data, isUgc: data ? proposalRequiresUgcDraft(data) : false };
  }
  const { data } = await admin
    .from("campaign_applications")
    .select(
      "id, influencer_id, status, deliverable_draft_upload_id, deliverable_draft_status, deliverable_draft_review_note, deliverable_draft_revision_count, brand_campaigns ( deliverables, deliverables_en, platforms, title, brand_id, brands ( brand_name, contact_email ) )"
    )
    .eq("id", id)
    .maybeSingle();
  const campaignRaw = data?.brand_campaigns as unknown;
  const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as {
    deliverables?: string;
    deliverables_en?: string;
    platforms?: string[];
    title?: string;
    brand_id?: string;
    brands?: { brand_name?: string; contact_email?: string } | { brand_name?: string; contact_email?: string }[] | null;
  } | null;
  return {
    admin,
    data,
    campaign,
    isUgc: campaign ? campaignRequiresUgcDraft(campaign) : false,
  };
}

function draftApproved(row: { deliverable_draft_status?: string | null } | null): boolean {
  return String(row?.deliverable_draft_status || "").toLowerCase() === "approved";
}

/** Submit / approve / request changes on UGC draft media. */
export async function POST(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const source: Source | null =
    body.source === "proposal" ? "proposal" : body.source === "campaign" ? "campaign" : null;
  const id = apiBodyString(body.id).trim();
  const action = apiBodyString(body.action).trim() as Action;
  const uploadId = apiBodyString(body.uploadId).trim();
  if (!source || !id || !["submit", "approve", "request_changes"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const loaded = await loadCollabRow(source, id);
  if (!loaded.data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let party: "influencer" | "brand" | null = null;
  if (source === "proposal") {
    const session = await requireActor(request);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const proposal = await loadProposal(id);
    if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
    party = partyOf(session.actor, proposal);
  } else {
    party = await ownCampaignApplicationParty(id, user.id, user.email || "");
    if (loaded.data.status !== "accepted" && action === "submit") {
      return NextResponse.json({ error: "not_accepted" }, { status: 400 });
    }
  }
  if (!party) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const row = loaded.data;
  const isUgc = loaded.isUgc;
  const revisionCount = Number(row.deliverable_draft_revision_count) || 0;
  const table = source === "proposal" ? "proposals" : "campaign_applications";

  if (action === "submit") {
    if (party !== "influencer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const draftUploadId = uploadId || String(row.deliverable_draft_upload_id || "");
    if (!draftUploadId) return NextResponse.json({ error: "missing_upload" }, { status: 400 });

    const { data: upload } = await loaded.admin
      .from("creator_media_uploads")
      .select("id, status, influencer_id, purpose")
      .eq("id", draftUploadId)
      .eq("influencer_id", row.influencer_id)
      .maybeSingle();
    if (!upload || upload.status !== "ready") {
      return NextResponse.json({ error: "upload_not_ready" }, { status: 400 });
    }

    const { error } = await loaded.admin
      .from(table)
      .update({
        deliverable_draft_upload_id: draftUploadId,
        deliverable_draft_status: "submitted",
        deliverable_draft_review_note: null,
      })
      .eq("id", id);
    if (error) {
      if (/deliverable_draft|schema cache|column/i.test(error.message || "")) {
        return NextResponse.json({ error: "migration_pending" }, { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    deferAfterResponse(() =>
      notifyDraftReview({
        source,
        id,
        action: "submitted",
        influencerId: String(row.influencer_id),
        brandName: loaded.campaign?.brands
          ? Array.isArray(loaded.campaign.brands)
            ? loaded.campaign.brands[0]?.brand_name
            : loaded.campaign.brands.brand_name
          : undefined,
        campaignTitle: loaded.campaign?.title,
      })
    );
    return NextResponse.json({ ok: true, status: "submitted" });
  }

  if (party !== "brand") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const reviewNote =
    (apiBodyString(body.reviewNote) || apiBodyString(body.note)).trim();
  if (action === "request_changes") {
    if (!reviewNote) return NextResponse.json({ error: "review_note_required" }, { status: 400 });
    if (!canRequestDraftChanges(isUgc, revisionCount, row.deliverable_draft_status)) {
      return NextResponse.json({ error: "revision_limit_reached" }, { status: 409 });
    }
    const { error } = await loaded.admin
      .from(table)
      .update({
        deliverable_draft_status: "changes_requested",
        deliverable_draft_review_note: reviewNote,
        deliverable_draft_revision_count: nextDraftRevisionCount(revisionCount),
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    deferAfterResponse(() =>
      notifyDraftReview({
        source,
        id,
        action: "changes_requested",
        influencerId: String(row.influencer_id),
        reviewNote,
      })
    );
    return NextResponse.json({ ok: true, status: "changes_requested" });
  }

  if (action === "approve") {
    if (String(row.deliverable_draft_status || "") !== "submitted") {
      return NextResponse.json({ error: "not_submitted" }, { status: 400 });
    }
    const { error } = await loaded.admin
      .from(table)
      .update({
        deliverable_draft_status: "approved",
        deliverable_draft_review_note: reviewNote || null,
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    deferAfterResponse(() =>
      notifyDraftReview({
        source,
        id,
        action: "approved",
        influencerId: String(row.influencer_id),
      })
    );
    return NextResponse.json({ ok: true, status: "approved" });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

/** Whether published link can be submitted (UGC flows require approved draft). */
export async function GET(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  const source: Source | null =
    sp.get("source") === "proposal" ? "proposal" : sp.get("source") === "campaign" ? "campaign" : null;
  const id = sp.get("id")?.trim() || "";
  if (!source || !id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const loaded = await loadCollabRow(source, id);
  if (!loaded.data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const needsDraft = loaded.isUgc;
  const approved = draftApproved(loaded.data);
  return NextResponse.json({
    needsDraft,
    draftApproved: approved,
    maySubmitPublishedLink: !needsDraft || approved,
    draftStatus: loaded.data.deliverable_draft_status,
    uploadId: loaded.data.deliverable_draft_upload_id,
    revisionCount: loaded.data.deliverable_draft_revision_count ?? 0,
  });
}