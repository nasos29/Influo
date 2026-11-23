import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sniffMediaType, validateChunk } from "@/lib/portfolioUpload";
import {
  UPLOAD_COLUMNS,
  loadUpload,
  removeUploadChunks,
  resolveUploadActor,
  uploadJson,
  type UploadRow,
} from "@/lib/portfolioUploadServer";
import {
  assembleSourceFile,
  chunkOnDisk,
  contiguousReceivedBytes,
  ensureUploadDir,
  expectedChunkLength,
  readChunkHead,
  writeChunkPart,
} from "@/lib/portfolioUploadStaging";
import { triggerPortfolioMediaWorker } from "@/lib/triggerPortfolioMediaWorker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type UploadActor = { admin: SupabaseClient; influencerId: string };

type FinalizeUploadResult =
  | { status: "noop"; row: UploadRow }
  | { status: "incomplete"; received: number }
  | { status: "assembly_failed" }
  | { status: "finalized"; row: UploadRow };

/** All contiguous bytes on disk → assemble source, mark uploaded, queue worker (idempotent). */
async function finalizeUploadFromDisk(actor: UploadActor, row: UploadRow): Promise<FinalizeUploadResult> {
  if (row.status !== "uploading") {
    return { status: "noop", row };
  }
  const totalBytes = Number(row.total_bytes);
  const chunkBytes = Number(row.chunk_bytes);
  const dir = await ensureUploadDir(row.influencer_id, row.id);
  const received = await contiguousReceivedBytes(dir, totalBytes, chunkBytes);
  if (received !== totalBytes) {
    return { status: "incomplete", received };
  }
  try {
    await assembleSourceFile(dir, totalBytes, chunkBytes, row.file_name, row.mime_type);
  } catch {
    return { status: "assembly_failed" };
  }
  const { data } = await actor.admin
    .from("creator_media_uploads")
    .update({ status: "uploaded", received_bytes: totalBytes, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "uploading")
    .select(UPLOAD_COLUMNS)
    .maybeSingle();
  triggerPortfolioMediaWorker();
  if (data) {
    return { status: "finalized", row: data as UploadRow };
  }
  const reloaded = await loadUpload(actor.admin, row.id, actor.influencerId);
  return { status: "noop", row: reloaded || row };
}

function finalizeUploadResponse(result: FinalizeUploadResult, row: UploadRow): NextResponse {
  switch (result.status) {
    case "noop":
      return NextResponse.json({ upload: uploadJson(result.row) });
    case "incomplete":
      return NextResponse.json(
        { error: "Upload incomplete", upload: uploadJson({ ...row, received_bytes: result.received }) },
        { status: 409 }
      );
    case "assembly_failed":
      return NextResponse.json({ error: "Assembly failed" }, { status: 500 });
    case "finalized":
      return NextResponse.json({ upload: uploadJson(result.row) });
  }
}

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
  const { row } = res;
  const dir = await ensureUploadDir(row.influencer_id, row.id);
  const diskReceived = await contiguousReceivedBytes(dir, Number(row.total_bytes), Number(row.chunk_bytes));
  const received = Math.max(Number(row.received_bytes), diskReceived);
  return NextResponse.json({ upload: uploadJson({ ...row, received_bytes: received }) });
}

/**
 * Upload one chunk: PUT ?offset=N with the raw bytes.
 * Chunks may arrive in parallel (out of order); assembly uses fixed offsets on disk.
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
  if (!Number.isInteger(offset) || offset < 0) {
    return NextResponse.json({ error: "bad offset", upload: uploadJson(row) }, { status: 400 });
  }

  const totalBytes = Number(row.total_bytes);
  const chunkBytes = Number(row.chunk_bytes);
  const dir = await ensureUploadDir(row.influencer_id, row.id);

  const chunkIndex = Math.floor(offset / chunkBytes);
  const knownLen = expectedChunkLength(chunkIndex, totalBytes, chunkBytes);
  if (knownLen > 0 && (await chunkOnDisk(dir, chunkIndex, knownLen))) {
    const received = await contiguousReceivedBytes(dir, totalBytes, chunkBytes);
    const merged = { ...row, received_bytes: Math.max(Number(row.received_bytes), received) };
    if (merged.received_bytes !== Number(row.received_bytes)) {
      await actor.admin
        .from("creator_media_uploads")
        .update({ received_bytes: merged.received_bytes, updated_at: new Date().toISOString() })
        .eq("id", row.id);
    }
    if (received === totalBytes) {
      return finalizeUploadResponse(await finalizeUploadFromDisk(actor, merged as UploadRow), merged as UploadRow);
    }
    return NextResponse.json({ upload: uploadJson(merged as UploadRow) });
  }

  const contentLength = Number(request.headers.get("content-length") || NaN);
  const expectedLen = expectedChunkLength(chunkIndex, totalBytes, chunkBytes);
  const check = validateChunk({
    offset,
    length: Number.isFinite(contentLength) ? contentLength : expectedLen,
    totalBytes,
    chunkBytes,
  });
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });

  try {
    await writeChunkPart(dir, check.index, request.body, expectedLen);
  } catch {
    return NextResponse.json({ error: "Storage write failed, retry" }, { status: 503 });
  }

  if (check.index === 0) {
    const head = await readChunkHead(dir, 0);
    if (head) {
      const sniffed = sniffMediaType(head);
      if (sniffed !== row.media_type) {
        await actor.admin
          .from("creator_media_uploads")
          .update({ status: "failed", error: "file content is not a supported video/photo", updated_at: new Date().toISOString() })
          .eq("id", row.id);
        return NextResponse.json({ error: "Unsupported file content", code: "type" }, { status: 415 });
      }
    }
  }

  const received = await contiguousReceivedBytes(dir, totalBytes, chunkBytes);
  const { data: updated } = await actor.admin
    .from("creator_media_uploads")
    .update({ received_bytes: received, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "uploading")
    .select(UPLOAD_COLUMNS)
    .maybeSingle();
  const fresh = (updated as UploadRow | null) || { ...row, received_bytes: received };
  if (received === totalBytes) {
    return finalizeUploadResponse(await finalizeUploadFromDisk(actor, fresh as UploadRow), fresh as UploadRow);
  }
  return NextResponse.json({ upload: uploadJson(fresh as UploadRow) });
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
    triggerPortfolioMediaWorker();
    return NextResponse.json({ upload: uploadJson((data as UploadRow | null) || row) });
  }
  if (body.action === "retry" && row.status === "uploading") {
    const totalBytes = Number(row.total_bytes);
    const chunkBytes = Number(row.chunk_bytes);
    const dir = await ensureUploadDir(row.influencer_id, row.id);
    const received = await contiguousReceivedBytes(dir, totalBytes, chunkBytes);
    if (received === totalBytes) {
      return finalizeUploadResponse(await finalizeUploadFromDisk(actor, row), row);
    }
  }
  if (body.action !== "complete") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  return finalizeUploadResponse(await finalizeUploadFromDisk(actor, row), row);
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