import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { ownCampaignApplicationParty } from "@/lib/collabDeliverableAccess";
import { mediaBucket } from "@/lib/mediaStorage";
import { loadProposal, partyOf, requireActor } from "@/lib/proposalAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Source = "proposal" | "campaign";

/** Authenticated download redirect for collab draft media (brand or creator only). */
export async function GET(request: NextRequest) {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const source: Source | null =
    sp.get("source") === "proposal" ? "proposal" : sp.get("source") === "campaign" ? "campaign" : null;
  const id = sp.get("id")?.trim() || "";
  const kind = sp.get("kind") === "photo" ? "photo" : "video";
  if (!source || !id) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if (source === "proposal") {
    const session = await requireActor(request);
    const proposal = await loadProposal(id);
    if (!session || !proposal || !partyOf(session.actor, proposal)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const party = await ownCampaignApplicationParty(id, user.id, user.email || "");
    if (!party) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = supabaseService();
  const table = source === "proposal" ? "proposals" : "campaign_applications";
  const { data: row } = await admin
    .from(table)
    .select("deliverable_draft_upload_id, influencer_id")
    .eq("id", id)
    .maybeSingle();
  const uploadId = row?.deliverable_draft_upload_id;
  if (!uploadId) return NextResponse.json({ error: "no_draft" }, { status: 404 });

  const { data: upload } = await admin
    .from("creator_media_uploads")
    .select("folder_path, media_type, status")
    .eq("id", uploadId)
    .eq("influencer_id", row.influencer_id)
    .maybeSingle();
  if (!upload || upload.status !== "ready" || !upload.folder_path) {
    return NextResponse.json({ error: "not_ready" }, { status: 404 });
  }

  const fileName = kind === "photo" || upload.media_type === "photo" ? "photo.webp" : "video.mp4";
  const path = `${String(upload.folder_path).replace(/\/+$/, "")}/${fileName}`;
  const { data: blob, error } = await admin.storage.from(mediaBucket()).download(path);
  if (error || !blob) {
    return NextResponse.json({ error: "download_failed" }, { status: 500 });
  }

  const headers = new Headers();
  headers.set("Content-Type", fileName.endsWith(".webp") ? "image/webp" : "video/mp4");
  headers.set("Content-Disposition", `attachment; filename="collab-draft-${id.slice(0, 8)}.${fileName.endsWith(".webp") ? "webp" : "mp4"}"`);
  headers.set("Cache-Control", "private, no-store");
  return new NextResponse(blob, { status: 200, headers });
}