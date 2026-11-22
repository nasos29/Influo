import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { MESSAGE_ATTACHMENTS_BUCKET } from "@/lib/chatAttachmentUpload";
import { verifyChatStorageObject } from "@/lib/chatAttachmentStorageVerify";
import {
  CHAT_UPLOAD_COLUMNS,
  chatUploadJson,
  loadChatUpload,
  resolveChatUploadActor,
  type ChatUploadRow,
} from "@/lib/chatAttachmentUploadServer";
import { publicSupabaseStorageObjectUrl } from "@/lib/supabaseServerUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const user = await userFromBearer(request);
  if (!user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const admin = supabaseService();
  const row = await loadChatUpload(admin, id, user.id);
  if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

  const actor = await resolveChatUploadActor(request, row.conversation_id);
  if (actor instanceof NextResponse) return actor;

  if (row.status === "ready" && row.public_url) {
    return NextResponse.json({ success: true, upload: chatUploadJson(row) });
  }
  if (row.status !== "uploading") {
    return NextResponse.json(
      { success: false, error: "Upload is not completing", upload: chatUploadJson(row) },
      { status: 409 }
    );
  }

  const objectName = row.storage_path;
  if (!objectName) {
    return NextResponse.json({ success: false, error: "Missing storage path" }, { status: 500 });
  }

  const expected = Number(row.total_bytes);
  const verified = await verifyChatStorageObject(
    admin,
    MESSAGE_ATTACHMENTS_BUCKET,
    objectName,
    expected,
    row.mime_type
  );
  if (!verified.ok) {
    await admin.storage.from(MESSAGE_ATTACHMENTS_BUCKET).remove([objectName]).catch(() => undefined);
    const verifyErr =
      verified.reason === "mime"
        ? "Stored object MIME type mismatch"
        : verified.reason === "size"
          ? "Stored object size mismatch"
          : "Object not found";
    await actor.admin
      .from("message_attachment_uploads")
      .update({
        status: "failed",
        error: verifyErr,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "uploading");
    return NextResponse.json(
      {
        success: false,
        error: verifyErr,
        upload: chatUploadJson({ ...row, status: "failed", error: verifyErr }),
      },
      { status: 409 }
    );
  }

  const publicUrl = publicSupabaseStorageObjectUrl(MESSAGE_ATTACHMENTS_BUCKET, objectName);

  const { data, error } = await actor.admin
    .from("message_attachment_uploads")
    .update({
      status: "ready",
      received_bytes: expected,
      public_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "uploading")
    .select(CHAT_UPLOAD_COLUMNS)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: "Could not finalize upload" }, { status: 500 });
  }

  const fresh = (data as ChatUploadRow | null) || {
    ...row,
    status: "ready",
    received_bytes: expected,
    public_url: publicUrl,
  };
  return NextResponse.json({ success: true, upload: chatUploadJson(fresh as ChatUploadRow) });
}