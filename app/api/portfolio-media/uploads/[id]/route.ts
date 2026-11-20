import { NextRequest, NextResponse } from "next/server";
import { PORTFOLIO_UPLOAD_BUCKET, chunkObjectPath, sniffMediaType, validateChunk } from "@/lib/portfolioUpload";
import {
  UPLOAD_COLUMNS,
  loadUpload,
  removeUploadChunks,
  resolveUploadActor,
  uploadJson,
  type UploadRow,
} from "@/lib/portfolioUploadServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function actorAndUpload(request: NextRequest, params: Params) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const actor = await resolveUploadActor(request, request.nextUrl.searchParams.get("influencerId"));
  if (actor instanceof NextResponse) return actor;
  const row = await loadUpload(actor.admin, id, actor.influencerId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return { actor, row };
}

/** Status + bytes received (resume point). */
export async function GET(request: NextRequest, { params }: { params: Params }) {
  const res = await actorAndUpload(request, params);
  if (res instanceof NextResponse) return res;
  return NextResponse.json({ upload: uploadJson(res.row) });
}

/**
 * Upload one chunk: PUT ?offset=N with the raw bytes.
 * A chunk the server already has is acknowledged (safe retry after a network drop).
 */
export async function PUT(request: NextRequest, { params }: { params: Params }) {
  const res = await actorAndUpload(request, params);
  if (res instanceof NextResponse) return res;
  const { actor, row } = res;
  if (row.status !== "uploading") {
    return NextResponse.json({ error: "Upload is not accepting data", upload: uploadJson(row) }, { status: 409 });
  }
  const offset = Number(request.nextUrl.searchParams.get("offset"));
  const received = Number(row.received_bytes);
  if (Number.isInteger(offset) && offset < received) {
    return NextResponse.json({ upload: uploadJson(row) });
  }
  if (offset !== received) {
    return NextResponse.json({ error: "Offset mismatch", upload: uploadJson(row) }, { status: 409 });
  }

  const buf = new Uint8Array(await request.arrayBuffer());
  const check = validateChunk({
    offset,
    length: buf.byteLength,
    totalBytes: Number(row.total_bytes),
    chunkBytes: Number(row.chunk_bytes),
  });
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });

  if (check.index === 0) {
    const sniffed = sniffMediaType(buf.subarray(0, 64));
    if (sniffed !== row.media_type) {
      await actor.admin
        .from("creator_media_uploads")
        .update({ status: "failed", error: "file content is not a supported video/photo", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      return NextResponse.json({ error: "Unsupported file content", code: "type" }, { status: 415 });
    }
  }

  const path = chunkObjectPath(row.influencer_id, row.id, check.index);
  const { error: upErr } = await actor.admin.storage
    .from(PORTFOLIO_UPLOAD_BUCKET)
    .upload(path, buf, { contentType: "application/octet-stream", upsert: true });
  if (upErr) return NextResponse.json({ error: "Storage write failed, retry" }, { status: 503 });

  const { data: updated } = await actor.admin
    .from("creator_media_uploads")
    .update({ received_bytes: offset + buf.byteLength, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("received_bytes", offset)
    .eq("status", "uploading")
    .select(UPLOAD_COLUMNS)
    .maybeSingle();
  const fresh = (updated as UploadRow | null) || (await loadUpload(actor.admin, row.id, actor.influencerId)) || row;
  return NextResponse.json({ upload: uploadJson(fresh) });
}

/** Finish: all bytes received → queue for encoding. Body: { action: "complete" } */
export async function POST(request: NextRequest, { params }: { params: Params }) {
  const res = await actorAndUpload(request, params);
  if (res instanceof NextResponse) return res;
  const { actor, row } = res;
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action === "retry" && row.status === "failed" && Number(row.received_bytes) === Number(row.total_bytes)) {
    const { data } = await actor.admin
      .from("creator_media_uploads")
      .update({ status: "uploaded", error: null, attempts: 0, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "failed")
      .select(UPLOAD_COLUMNS)
      .maybeSingle();
    return NextResponse.json({ upload: uploadJson((data as UploadRow | null) || row) });
  }
  if (body.action !== "complete") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (row.status !== "uploading") return NextResponse.json({ upload: uploadJson(row) });
  if (Number(row.received_bytes) !== Number(row.total_bytes)) {
    return NextResponse.json({ error: "Upload incomplete", upload: uploadJson(row) }, { status: 409 });
  }
  const { data } = await actor.admin
    .from("creator_media_uploads")
    .update({ status: "uploaded", updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "uploading")
    .select(UPLOAD_COLUMNS)
    .maybeSingle();
  return NextResponse.json({ upload: uploadJson((data as UploadRow | null) || row) });
}

/** Cancel an upload that is not yet processed; staged chunks are removed. */
export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const res = await actorAndUpload(request, params);
  if (res instanceof NextResponse) return res;
  const { actor, row } = res;
  if (row.status === "processing" || row.status === "ready") {
    return NextResponse.json({ error: "Already processing", upload: uploadJson(row) }, { status: 409 });
  }
  await actor.admin
    .from("creator_media_uploads")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .in("status", ["uploading", "uploaded", "failed"]);
  await removeUploadChunks(actor.admin, row);
  return NextResponse.json({ ok: true });
}
