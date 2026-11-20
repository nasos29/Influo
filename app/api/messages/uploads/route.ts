import { NextRequest, NextResponse } from "next/server";
import {
  MAX_ACTIVE_CHAT_UPLOADS_PER_USER,
  MESSAGE_ATTACHMENTS_BUCKET,
  attachmentDisplayFilename,
  validateChatAttachment,
  CHAT_UPLOAD_CHUNK_BYTES,
} from "@/lib/chatAttachmentUpload";
import { buildChatAttachmentObjectName } from "@/lib/chatAttachmentObjectName";
import { createChatAttachmentSignedUploadToken } from "@/lib/chatSignedStorageUpload";
import {
  CHAT_UPLOAD_COLUMNS,
  countActiveChatUploads,
  parseChatUploadConversationId,
  resolveChatUploadActor,
  type ChatUploadRow,
} from "@/lib/chatAttachmentUploadServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start a direct-to-storage TUS chat video upload. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const conversationId = parseChatUploadConversationId(body.conversationId ?? body.conversation_id);
  if (!conversationId) {
    return NextResponse.json({ success: false, error: "Invalid conversation" }, { status: 400 });
  }
  const actor = await resolveChatUploadActor(request, conversationId);
  if (actor instanceof NextResponse) return actor;
  const lang = body.lang === "en" ? "en" : "el";

  const fileNameRaw = typeof body.fileName === "string" ? body.fileName : null;
  const displayName = fileNameRaw ? attachmentDisplayFilename(fileNameRaw) : null;
  const check = validateChatAttachment({
    mimeType: typeof body.mimeType === "string" ? body.mimeType : null,
    fileName: displayName,
    size: Number(body.size),
  });
  if (!check.ok) {
    return NextResponse.json({ success: false, error: check.message[lang], code: check.code }, { status: 400 });
  }
  if (check.kind !== "video") {
    return NextResponse.json({ success: false, error: "TUS upload is for large videos only", code: "type" }, { status: 400 });
  }

  const active = await countActiveChatUploads(actor.admin, actor.userId);
  if (active >= MAX_ACTIVE_CHAT_UPLOADS_PER_USER) {
    return NextResponse.json(
      { success: false, error: lang === "en" ? "Too many uploads in progress" : "Πολλά ανεβάσματα σε εξέλιξη", code: "busy" },
      { status: 429 }
    );
  }

  const objectName = buildChatAttachmentObjectName(conversationId, displayName, check.mimeType);
  let token: string;
  try {
    const signed = await createChatAttachmentSignedUploadToken(
      actor.admin,
      MESSAGE_ATTACHMENTS_BUCKET,
      objectName
    );
    token = signed.token;
  } catch {
    return NextResponse.json({ success: false, error: "Could not start upload" }, { status: 500 });
  }

  const { data: row, error } = await actor.admin
    .from("message_attachment_uploads")
    .insert({
      conversation_id: conversationId,
      created_by: actor.userId,
      attachment_kind: check.kind,
      mime_type: check.mimeType,
      file_name: displayName,
      total_bytes: Math.floor(Number(body.size)),
      chunk_bytes: CHAT_UPLOAD_CHUNK_BYTES,
      storage_path: objectName,
    })
    .select(CHAT_UPLOAD_COLUMNS)
    .single();
  if (error || !row) {
    await actor.admin.storage.from(MESSAGE_ATTACHMENTS_BUCKET).remove([objectName]).catch(() => undefined);
    return NextResponse.json({ success: false, error: "Could not start upload" }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      uploadId: (row as ChatUploadRow).id,
      bucket: MESSAGE_ATTACHMENTS_BUCKET,
      objectName,
      token,
    },
    { status: 201 }
  );
}