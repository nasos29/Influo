import { NextRequest, NextResponse } from "next/server";
import { rm, stat } from "node:fs/promises";
import path from "node:path";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { validateChunk } from "@/lib/portfolioUpload";
import {
  MESSAGE_ATTACHMENTS_BUCKET,
  attachmentDisplayFilename,
  attachmentStorageBasename,
  sniffChatAttachmentKind,
} from "@/lib/chatAttachmentUpload";
import {
  assembleSourceFile,
  chunkOnDisk,
  contiguousReceivedBytes,
  ensureChatUploadDir,
  expectedChunkLength,
  readChunkHead,
  removeChatUploadStaging,
  writeChunkPart,
} from "@/lib/chatAttachmentUploadStaging";
import {
  CHAT_UPLOAD_COLUMNS,
  chatUploadJson,
  loadChatUpload,
  resolveChatUploadActor,
  type ChatUploadRow,
} from "@/lib/chatAttachmentUploadServer";
import { tusUploadFileFromPath } from "@/lib/storageTusUpload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function actorAndUpload(request: NextRequest, params: Params) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const admin = supabaseService();
  const row = await loadChatUpload(admin, id, user.id);
  if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  const actor = await resolveChatUploadActor(request, row.conversation_id);
  if (actor instanceof NextResponse) return actor;
  return { actor, row };
}

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const res = await actorAndUpload(request, params);
  if (res instanceof NextResponse) return res;
  const { row, actor } = res;
  const dir = await ensureChatUploadDir(actor.userId, row.id);
  const diskReceived = await contiguousReceivedBytes(dir, Number(row.total_bytes), Number(row.chunk_bytes));
  const received = Math.max(Number(row.received_bytes), diskReceived);
  return NextResponse.json({ success: true, upload: chatUploadJson({ ...row, received_bytes: received }) });
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  const res = await actorAndUpload(request, params);
  if (res instanceof NextResponse) return res;
  const { actor, row } = res;
  if (row.status !== "uploading") {
    return NextResponse.json(
      { success: false, error: "Upload is not accepting data", upload: chatUploadJson(row) },
      { status: 409 }
    );
  }
  const offset = Number(request.nextUrl.searchParams.get("offset"));
  if (!Number.isInteger(offset) || offset < 0) {
    return NextResponse.json({ success: false, error: "bad offset", upload: chatUploadJson(row) }, { status: 400 });
  }

  const totalBytes = Number(row.total_bytes);
  const chunkBytes = Number(row.chunk_bytes);
  const dir = await ensureChatUploadDir(actor.userId, row.id);
  const chunkIndex = Math.floor(offset / chunkBytes);
  const knownLen = expectedChunkLength(chunkIndex, totalBytes, chunkBytes);

  if (knownLen > 0 && (await chunkOnDisk(dir, chunkIndex, knownLen))) {
    const received = await contiguousReceivedBytes(dir, totalBytes, chunkBytes);
    const merged = { ...row, received_bytes: Math.max(Number(row.received_bytes), received) };
    if (merged.received_bytes !== Number(row.received_bytes)) {
      await actor.admin
        .from("message_attachment_uploads")
        .update({ received_bytes: merged.received_bytes, updated_at: new Date().toISOString() })
        .eq("id", row.id);
    }
    return NextResponse.json({ success: true, upload: chatUploadJson(merged as ChatUploadRow) });
  }

  const contentLength = Number(request.headers.get("content-length") || NaN);
  const expectedLen = expectedChunkLength(chunkIndex, totalBytes, chunkBytes);
  const check = validateChunk({
    offset,
    length: Number.isFinite(contentLength) ? contentLength : expectedLen,
    totalBytes,
    chunkBytes,
  });
  if (!check.ok) return NextResponse.json({ success: false, error: check.reason }, { status: 400 });

  try {
    await writeChunkPart(dir, check.index, request.body, expectedLen);
  } catch {
    return NextResponse.json({ success: false, error: "Storage write failed, retry" }, { status: 503 });
  }

  if (check.index === 0) {
    const head = await readChunkHead(dir, 0);
    if (head && !sniffChatAttachmentKind(head, row.attachment_kind)) {
      await actor.admin
        .from("message_attachment_uploads")
        .update({
          status: "failed",
          error: "file content does not match declared type",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      await removeChatUploadStaging(actor.userId, row.id);
      return NextResponse.json({ success: false, error: "Unsupported file content", code: "type" }, { status: 415 });
    }
  }

  const received = await contiguousReceivedBytes(dir, totalBytes, chunkBytes);
  const { data: updated } = await actor.admin
    .from("message_attachment_uploads")
    .update({ received_bytes: received, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "uploading")
    .select(CHAT_UPLOAD_COLUMNS)
    .maybeSingle();
  const fresh = (updated as ChatUploadRow | null) || { ...row, received_bytes: received };
  return NextResponse.json({ success: true, upload: chatUploadJson(fresh as ChatUploadRow) });
}

function storageExtension(fileName: string | null, mimeType: string): string {
  const ext = path.extname(String(fileName || "")).toLowerCase();
  if (ext && ext.length <= 6) return ext.replace(/^\./, "");
  const mt = mimeType.toLowerCase();
  if (mt.includes("quicktime")) return "mov";
  if (mt.includes("webm")) return "webm";
  if (mt.includes("3gpp")) return "3gp";
  return "mp4";
}

async function failUploadAndCleanup(
  actor: { admin: ReturnType<typeof supabaseService>; userId: string },
  row: ChatUploadRow,
  error: string
): Promise<NextResponse> {
  await actor.admin
    .from("message_attachment_uploads")
    .update({ status: "failed", error, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .in("status", ["uploading"]);
  await removeChatUploadStaging(actor.userId, row.id);
  return NextResponse.json(
    { success: false, error, upload: chatUploadJson({ ...row, status: "failed", error }) },
    { status: 500 }
  );
}

async function uploadAssembledToBucket(
  actor: { admin: ReturnType<typeof supabaseService> },
  row: ChatUploadRow,
  sourcePath: string,
  fileSize: number
): Promise<{ storagePath: string; publicUrl: string }> {
  const displayName = attachmentDisplayFilename(row.file_name);
  const ext = storageExtension(displayName, row.mime_type);
  const leaf = attachmentStorageBasename(displayName, ext);
  const storagePath = `conversations/${row.conversation_id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${leaf}`;

  await tusUploadFileFromPath({
    filePath: sourcePath,
    fileSize,
    bucketName: MESSAGE_ATTACHMENTS_BUCKET,
    objectName: storagePath,
    contentType: row.mime_type,
    cacheControl: "3600",
    upsert: false,
  });

  const { data } = actor.admin.storage.from(MESSAGE_ATTACHMENTS_BUCKET).getPublicUrl(storagePath);
  return { storagePath, publicUrl: data.publicUrl };
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const res = await actorAndUpload(request, params);
  if (res instanceof NextResponse) return res;
  const { actor, row } = res;
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "complete") {
    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  }
  if (row.status !== "uploading") {
    return NextResponse.json({ success: true, upload: chatUploadJson(row) });
  }

  const totalBytes = Number(row.total_bytes);
  const chunkBytes = Number(row.chunk_bytes);
  const dir = await ensureChatUploadDir(actor.userId, row.id);
  const received = await contiguousReceivedBytes(dir, totalBytes, chunkBytes);
  if (received !== totalBytes) {
    return NextResponse.json(
      { success: false, error: "Upload incomplete", upload: chatUploadJson({ ...row, received_bytes: received }) },
      { status: 409 }
    );
  }

  let sourcePath: string;
  try {
    sourcePath = await assembleSourceFile(dir, totalBytes, chunkBytes, row.file_name, row.mime_type);
  } catch {
    return failUploadAndCleanup(actor, row, "Assembly failed");
  }

  let fileSize = totalBytes;
  try {
    const st = await stat(sourcePath);
    fileSize = st.size;
  } catch {
    return failUploadAndCleanup(actor, row, "Could not read assembled file");
  }

  let uploaded: { storagePath: string; publicUrl: string };
  try {
    uploaded = await uploadAssembledToBucket(actor, row, sourcePath, fileSize);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Storage upload failed";
    return failUploadAndCleanup(actor, row, msg);
  }

  await rm(sourcePath, { force: true }).catch(() => undefined);
  await removeChatUploadStaging(actor.userId, row.id);

  const chunkDir = path.join(dir, "chunks");
  for (let i = 0; ; i++) {
    const part = path.join(chunkDir, `${String(i).padStart(5, "0")}.part`);
    try {
      await rm(part, { force: true });
    } catch {
      break;
    }
  }

  const { data } = await actor.admin
    .from("message_attachment_uploads")
    .update({
      status: "ready",
      received_bytes: totalBytes,
      storage_path: uploaded.storagePath,
      public_url: uploaded.publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "uploading")
    .select(CHAT_UPLOAD_COLUMNS)
    .maybeSingle();

  const fresh = (data as ChatUploadRow | null) || {
    ...row,
    status: "ready",
    storage_path: uploaded.storagePath,
    public_url: uploaded.publicUrl,
  };
  return NextResponse.json({ success: true, upload: chatUploadJson(fresh as ChatUploadRow) });
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const res = await actorAndUpload(request, params);
  if (res instanceof NextResponse) return res;
  const { actor, row } = res;
  if (row.status === "ready") {
    return NextResponse.json({ success: false, error: "Already completed", upload: chatUploadJson(row) }, { status: 409 });
  }
  await actor.admin
    .from("message_attachment_uploads")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .in("status", ["uploading", "failed"]);
  await removeChatUploadStaging(actor.userId, row.id);
  return NextResponse.json({ success: true });
}