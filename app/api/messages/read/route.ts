import { NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { isChatParticipant, loadChatActor } from "@/lib/chatActor";
import { otherPartySender, unreadFromOtherParty, type ReadViewer } from "@/lib/messageRead";

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

    const other = otherPartySender(asRole);
    const pending = await admin
      .from("messages")
      .select("id, sender_type, read")
      .eq("conversation_id", conversationId)
      .eq("sender_type", other)
      .or("read.eq.false,read.is.null");
    if (pending.error) return NextResponse.json({ error: pending.error.message }, { status: 500 });

    const ids = unreadFromOtherParty(
      (pending.data || []) as { id: string; sender_type: string; read: boolean | null }[],
      asRole,
    );
    if (ids.length === 0) {
      return NextResponse.json({ success: true, ids: [] });
    }

    // Update by id. An UPDATE filtered on read=false returns no rows once read is true,
    // and the client used to treat that empty list as "leave the badge".
    const updated = await admin.from("messages").update({ read: true }).in("id", ids);
    if (updated.error) return NextResponse.json({ error: updated.error.message }, { status: 500 });

    return NextResponse.json({ success: true, ids });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Read update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
