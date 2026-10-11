import { NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { isChatParticipant, loadChatActor } from "@/lib/chatActor";
import { otherPartySender, type ReadViewer } from "@/lib/messageRead";

/**
 * The recipient marks the other party's unread messages as read.
 * Only { read: true } is written. email_sent, presence, and content stay untouched.
 * Callers must be a participant and must be the role they claim.
 */
export async function POST(req: Request) {
  try {
    const user = await userFromBearer(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const actor = await loadChatActor(user);

    const body = await req.json().catch(() => ({}));
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
    const asRole: ReadViewer | null = body.as === "influencer" || body.as === "brand" ? body.as : null;
    if (!conversationId || !asRole) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (asRole === "influencer" && !actor.influencerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (asRole === "brand" && !actor.brandEmail) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = supabaseService();
    const { data: conv } = await admin
      .from("conversations")
      .select("id, influencer_id, brand_email")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!isChatParticipant(actor, conv)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (asRole === "influencer" && actor.influencerId !== conv.influencer_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (asRole === "brand" && actor.brandEmail !== String(conv.brand_email || "").toLowerCase().trim()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await admin
      .from("messages")
      .update({ read: true })
      .eq("conversation_id", conversationId)
      .eq("sender_type", otherPartySender(asRole))
      .or("read.eq.false,read.is.null")
      .select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      ids: (data || []).map((row) => String((row as { id: string }).id)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Read update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
