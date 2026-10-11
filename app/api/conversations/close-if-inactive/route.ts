import { NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { isChatParticipant, loadChatActor } from "@/lib/chatActor";
import { closeConversation } from "@/lib/closeConversation";

const INACTIVE_MS = 10 * 60 * 1000;

/** Participant-only. Closes a quiet thread. The summary email waits for the quiet window. */
export async function GET(req: Request) {
  try {
    const user = await userFromBearer(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conversationId = new URL(req.url).searchParams.get("conversationId") || "";
    if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

    const actor = await loadChatActor(user);
    const admin = supabaseService();
    const { data: conv, error } = await admin
      .from("conversations")
      .select("id, closed_at, last_message_at, influencer_id, brand_email")
      .eq("id", conversationId)
      .maybeSingle();
    if (error || !conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    if (!isChatParticipant(actor, conv)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (conv.closed_at) return NextResponse.json({ success: true, closed: true, message: "Already closed" });

    const last = conv.last_message_at ? new Date(conv.last_message_at).getTime() : 0;
    const isInactive = !last || Date.now() - last >= INACTIVE_MS;
    if (!isInactive) {
      return NextResponse.json({
        success: true,
        closed: false,
        message: "Conversation still active",
        lastMessageAt: conv.last_message_at,
      });
    }

    const closed = await closeConversation(conversationId);
    if (!closed.success) return NextResponse.json({ error: closed.error || "Failed to close conversation" }, { status: 500 });
    return NextResponse.json({ success: true, closed: true, message: "Conversation closed" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Close failed";
    console.error("[Close-if-inactive]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
