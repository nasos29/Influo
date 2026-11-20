import { NextRequest, NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { MESSAGE_ATTACHMENTS_BUCKET } from "@/lib/chatAttachmentUpload";
import { chatUploadJson, loadChatUpload, resolveChatUploadActor, type ChatUploadRow } from "@/lib/chatAttachmentUploadServer";

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
  if (row.storage_path) {
    await actor.admin.storage.from(MESSAGE_ATTACHMENTS_BUCKET).remove([row.storage_path]).catch(() => undefined);
  }
  return NextResponse.json({ success: true });
}