import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { isChatParticipant, loadChatActor } from "@/lib/chatActor";
import {
  CHAT_UPLOAD_CHUNK_BYTES,
  isChatUploadConversationUuid,
  parseChatUploadConversationId,
} from "@/lib/chatAttachmentUpload";
import type { ChatAttachmentKind } from "@/lib/chatAttachmentUpload";

export type ChatUploadRow = {
  id: string;
  conversation_id: string;
  created_by: string;
  attachment_kind: ChatAttachmentKind;
  mime_type: string;
  file_name: string | null;
  total_bytes: number;
  chunk_bytes: number;
  received_bytes: number;
  status: string;
  storage_path: string | null;
  public_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export const CHAT_UPLOAD_COLUMNS =
  "id, conversation_id, created_by, attachment_kind, mime_type, file_name, total_bytes, chunk_bytes, received_bytes, status, storage_path, public_url, error, created_at, updated_at";

export { parseChatUploadConversationId } from "@/lib/chatAttachmentUpload";

export function chatUploadJson(row: ChatUploadRow) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    kind: row.attachment_kind,
    fileName: row.file_name,
    totalBytes: Number(row.total_bytes),
    chunkBytes: Number(row.chunk_bytes),
    receivedBytes: Number(row.received_bytes),
    status: row.status,
    error: row.error,
    attachment:
      row.status === "ready" && row.public_url
        ? {
            url: row.public_url,
            filename: row.file_name || undefined,
            size: Number(row.total_bytes),
            content_type: row.mime_type,
          }
        : null,
  };
}

export async function resolveChatUploadActor(
  request: Request,
  conversationId: string
): Promise<{ admin: SupabaseClient; userId: string; actor: Awaited<ReturnType<typeof loadChatActor>> } | NextResponse> {
  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const actor = await loadChatActor(user);
  if (!parseChatUploadConversationId(conversationId)) {
    return NextResponse.json({ success: false, error: "Invalid conversation" }, { status: 400 });
  }
  const looksLikeId = isChatUploadConversationUuid(conversationId);
  if (looksLikeId) {
    const admin = supabaseService();
    const { data: conv } = await admin
      .from("conversations")
      .select("influencer_id, brand_email")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv || !isChatParticipant(actor, conv)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
  } else if (!actor.influencerId && !actor.brandEmail) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  return { admin: supabaseService(), userId: user.id, actor };
}

export async function loadChatUpload(
  admin: SupabaseClient,
  uploadId: string,
  userId: string
): Promise<ChatUploadRow | null> {
  const { data } = await admin
    .from("message_attachment_uploads")
    .select(CHAT_UPLOAD_COLUMNS)
    .eq("id", uploadId)
    .eq("created_by", userId)
    .maybeSingle();
  return (data as ChatUploadRow | null) || null;
}

export async function countActiveChatUploads(admin: SupabaseClient, userId: string): Promise<number> {
  const { count } = await admin
    .from("message_attachment_uploads")
    .select("id", { count: "exact", head: true })
    .eq("created_by", userId)
    .eq("status", "uploading");
  return count || 0;
}

export const DEFAULT_CHAT_CHUNK_BYTES = CHAT_UPLOAD_CHUNK_BYTES;