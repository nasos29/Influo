import { NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { isChatParticipant, loadChatActor } from "@/lib/chatActor";
import { closeConversation } from "@/lib/closeConversation";
import { runAdminMessageSummaries, runMessageSummaries } from "@/lib/messageSummaryRun";

/**
 * Either participant can close. An explicit close sends the unread participant
 * summary immediately and the admin summary for messages not yet notified.
 * Auto-close does not email participants early; it still emails the admin.
 */
export async function POST(req: Request) {
  try {
    const user = await userFromBearer(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
    const autoClose = body.autoClose === true;
    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID is required" }, { status: 400 });
    }

    const actor = await loadChatActor(user);
    const { data: conv } = await supabaseService()
      .from("conversations")
      .select("id, influencer_id, brand_email")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv || !isChatParticipant(actor, conv)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const closed = await closeConversation(conversationId);
    if (!closed.success) {
      return NextResponse.json({ error: closed.error || "Failed to close conversation" }, { status: 500 });
    }

    let summary: { sent: number; skipped: number; errors: string[]; adminSent?: number } | null = null;
    if (!closed.alreadyClosed) {
      try {
        summary = autoClose
          ? await runAdminMessageSummaries({ forceConversationId: conversationId }).then((admin) => ({
              sent: 0,
              skipped: 0,
              adminSent: admin.sent,
              errors: admin.errors,
            }))
          : await runMessageSummaries({ forceConversationId: conversationId });
      } catch (error) {
        console.error("[End Conversation] summary email failed:", error);
      }
    }

    return NextResponse.json({
      success: true,
      message: closed.alreadyClosed ? "Conversation already closed" : "Conversation closed",
      summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "End conversation error";
    console.error("End conversation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
