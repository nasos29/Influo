import { NextRequest, NextResponse } from "next/server";
import { userFromBearer } from "@/lib/apiAuth";
import { apiBodyString } from "@/lib/apiBodyString";
import { COLLAB_DELIVERABLE_UPLOAD_PURPOSE } from "@/lib/collabDeliverableUpload";
import { influencerIdForCollab, ownCampaignApplicationParty } from "@/lib/collabDeliverableAccess";
import { loadProposal, partyOf, requireActor } from "@/lib/proposalAccess";
import {
  MAX_ACTIVE_UPLOADS_PER_CREATOR,
  UPLOAD_CHUNK_BYTES,
  validateUploadRequest,
} from "@/lib/portfolioUpload";
import {
  UPLOAD_COLUMNS,
  countInFlightUploads,
  resolveUploadActor,
  uploadJson,
  type UploadRow,
} from "@/lib/portfolioUploadServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CollabSource = "proposal" | "campaign";

/** Creator: start chunked upload for collab UGC draft (no portfolio slot). */
export async function POST(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const source = body.source === "campaign" ? "campaign" : body.source === "proposal" ? "proposal" : null;
  const collabId = apiBodyString(body.id).trim();
  const lang = body.lang === "en" ? "en" : "el";
  if (!source || !collabId) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const influencerId = await influencerIdForCollab(source, collabId);
  if (!influencerId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (source === "proposal") {
    const session = await requireActor(request);
    const proposal = await loadProposal(collabId);
    if (!session || !proposal || partyOf(session.actor, proposal) !== "influencer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const party = await ownCampaignApplicationParty(collabId, user.id, user.email || "");
    if (party !== "influencer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 200) : null;
  const check = validateUploadRequest({
    mimeType: typeof body.mimeType === "string" ? body.mimeType : null,
    fileName,
    size: Number(body.size),
    durationSec: body.durationSec == null ? null : Number(body.durationSec),
  });
  if (!check.ok) {
    return NextResponse.json({ error: check.message[lang], code: check.code }, { status: 400 });
  }

  const actor = await resolveUploadActor(request, influencerId);
  if (actor instanceof NextResponse) return actor;

  const inFlight = await countInFlightUploads(actor.admin, influencerId);
  if (inFlight >= MAX_ACTIVE_UPLOADS_PER_CREATOR) {
    return NextResponse.json(
      { error: lang === "en" ? "Too many uploads in progress." : "Πολλά ανεβάσματα σε εξέλιξη.", code: "busy" },
      { status: 429 }
    );
  }

  const durationSec = Number(body.durationSec);
  const insert: Record<string, unknown> = {
    influencer_id: influencerId,
    created_by: user.id,
    media_type: check.mediaType,
    mime_type: check.mimeType,
    file_name: fileName,
    total_bytes: Math.floor(Number(body.size)),
    chunk_bytes: UPLOAD_CHUNK_BYTES,
    client_duration_ms:
      Number.isFinite(durationSec) && durationSec > 0 ? Math.round(durationSec * 1000) : null,
    purpose: COLLAB_DELIVERABLE_UPLOAD_PURPOSE,
  };
  if (source === "proposal") insert.collab_proposal_id = Number(collabId);
  else insert.collab_application_id = collabId;

  const { data: row, error } = await actor.admin
    .from("creator_media_uploads")
    .insert(insert)
    .select(UPLOAD_COLUMNS)
    .single();
  if (error || !row) {
    if (/collab_|purpose|schema cache|column/i.test(error?.message || "")) {
      return NextResponse.json({ error: "migration_pending" }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not start upload" }, { status: 500 });
  }

  return NextResponse.json({ upload: uploadJson(row as UploadRow) }, { status: 201 });
}