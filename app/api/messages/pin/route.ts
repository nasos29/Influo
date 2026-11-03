import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { sideForMessage } from "@/lib/chatMessageAccess";

export const dynamic = "force-dynamic";

/** Pin (one per conversation) or unpin a message. Either participant may do it. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const access = await sideForMessage(req, String(body.messageId || ""), body.as);
  if (access instanceof NextResponse) return access;
  const admin = supabaseService();
  if (body.pin) {
    await admin.from("messages").update({ pinned_at: null }).eq("conversation_id", access.conversationId).not("pinned_at", "is", null);
    await admin.from("messages").update({ pinned_at: new Date().toISOString() }).eq("id", body.messageId);
  } else {
    await admin.from("messages").update({ pinned_at: null }).eq("id", body.messageId);
  }
  return NextResponse.json({ ok: true });
}
