import { NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { isChatParticipant, loadChatActor } from "@/lib/chatActor";

const INACTIVE_MS = 10 * 60 * 1000;

export async function GET(req: Request) {
  try {
    const user = await userFromBearer(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const conversationId = new URL(req.url).searchParams.get("conversationId") || "";
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }

    const actor = await loadChatActor(user);
    const { data: conv, error } = await supabaseService()
      .from("conversations")
      .select("id, closed_at, last_message_at, influencer_id, brand_email")
      .eq("id", conversationId)
      .maybeSingle();
    if (error || !conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    if (!isChatParticipant(actor, conv)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const last = conv.last_message_at ? new Date(conv.last_message_at).getTime() : 0;
    return NextResponse.json({
      conversationId: conv.id,
      isClosed: !!conv.closed_at,
      isInactive: !last || Date.now() - last >= INACTIVE_MS,
      lastMessageAt: conv.last_message_at,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Check failed";
    console.error("[Check Inactive] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
