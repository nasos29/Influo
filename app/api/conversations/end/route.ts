import { NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { isChatParticipant, loadChatActor } from "@/lib/chatActor";
import { closeConversation } from "@/lib/closeConversation";
import { runMessageSummaries } from "@/lib/messageSummaryRun";

/**
 * Either participant can close. Closing sends the unread summary immediately
 * (messages already read in the app are skipped). Auto-close from the quiet
 * cron does not call this route.
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

    let summary: { sent: number; skipped: number; errors: string[] } | null = null;
    if (!autoClose && !closed.alreadyClosed) {
      try {
        summary = await runMessageSummaries({ forceConversationId: conversationId });
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
