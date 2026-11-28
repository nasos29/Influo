import { NextRequest, NextResponse } from "next/server";
import { rejectUnlessAdmin, supabaseService, userFromBearer } from "@/lib/apiAuth";
import { HOMEPAGE_SHOWCASE_UPLOAD_PURPOSE } from "@/lib/homepageShowcaseUpload";
import { resolveHomepageShowcaseUploadHostInfluencerId } from "@/lib/homepageShowcaseUploadServer";
import {
  MAX_ACTIVE_UPLOADS_PER_CREATOR,
  UPLOAD_CHUNK_BYTES,
  validateUploadRequest,
} from "@/lib/portfolioUpload";
import {
  UPLOAD_COLUMNS,
  countInFlightUploads,
  uploadJson,
  type UploadRow,
} from "@/lib/portfolioUploadServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin: start a homepage featured showcase video upload (reuses portfolio chunk PUT + worker). */
export async function POST(request: NextRequest) {
  const denied = await rejectUnlessAdmin(request);
  if (denied) return denied;

  const user = await userFromBearer(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 200) : null;
  const check = validateUploadRequest({
    mimeType: typeof body.mimeType === "string" ? body.mimeType : null,
    fileName,
    size: Number(body.size),
    durationSec: body.durationSec == null ? null : Number(body.durationSec),
  });
  if (!check.ok) {
    return NextResponse.json({ error: check.message.el, code: check.code }, { status: 400 });
  }
  if (check.mediaType !== "video") {
    return NextResponse.json({ error: "Επιτρέπονται μόνο βίντεο.", code: "type" }, { status: 400 });
  }

  const admin = supabaseService();
  const influencerId = await resolveHomepageShowcaseUploadHostInfluencerId(admin);
  if (!influencerId) {
    return NextResponse.json(
      { error: "Δεν βρέθηκε creator για αποθήκευση showcase." },
      { status: 503 }
    );
  }

  const inFlight = await countInFlightUploads(admin, influencerId);
  if (inFlight >= MAX_ACTIVE_UPLOADS_PER_CREATOR) {
    return NextResponse.json({ error: "Πολλά ανεβάσματα σε εξέλιξη. Περίμενε λίγο.", code: "busy" }, { status: 429 });
  }

  const durationSec = Number(body.durationSec);
  const { data: row, error } = await admin
    .from("creator_media_uploads")
    .insert({
      influencer_id: influencerId,
      created_by: user?.id ?? null,
      media_type: "video",
      mime_type: check.mimeType,
      file_name: fileName,
      total_bytes: Math.floor(Number(body.size)),
      chunk_bytes: UPLOAD_CHUNK_BYTES,
      client_duration_ms:
        Number.isFinite(durationSec) && durationSec > 0 ? Math.round(durationSec * 1000) : null,
      purpose: HOMEPAGE_SHOWCASE_UPLOAD_PURPOSE,
    })
    .select(UPLOAD_COLUMNS)
    .single();
  if (error || !row) {
    return NextResponse.json({ error: "Could not start upload" }, { status: 500 });
  }

  return NextResponse.json(
    { upload: uploadJson(row as UploadRow), influencerId },
    { status: 201 }
  );
}