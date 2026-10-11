import { NextResponse } from "next/server";
import { requireAdmin, supabaseService } from "@/lib/apiAuth";

const PAGE = 1000;
const MAX_CONVERSATIONS = 20000;
const MAX_MESSAGES = 5000;

const CONVERSATION_COLUMNS =
  "id, influencer_id, influencer_name, influencer_email, brand_email, brand_name, proposal_id, created_at, last_message_at, closed_at";
const MESSAGE_COLUMNS =
  "id, conversation_id, sender_id, sender_type, content, attachments, read, sent_via_email, created_at";

/**
 * Admin-only read of every brand↔influencer thread, including closed ones and attachments.
 * Service role bypasses participant RLS. This route never updates messages, presence, or email_sent.
 */
export async function GET(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const db = supabaseService();

    if (url.searchParams.get("count") === "unread") {
      const { count, error } = await db
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, count: count ?? 0 });
    }

    const conversationId = url.searchParams.get("conversationId") || "";
    if (conversationId) {
      const messages = await pageAll((from, to) =>
        db
          .from("messages")
          .select(MESSAGE_COLUMNS)
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .range(from, to)
      , MAX_MESSAGES);
      return NextResponse.json({ success: true, messages });
    }

    const conversations = await pageAll((from, to) =>
      db
        .from("conversations")
        .select(CONVERSATION_COLUMNS)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .range(from, to)
    , MAX_CONVERSATIONS);
    return NextResponse.json({ success: true, conversations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load conversations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function pageAll(
  load: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  max: number
): Promise<unknown[]> {
  const all: unknown[] = [];
  for (let from = 0; from < max; from += PAGE) {
    const to = Math.min(from + PAGE, max) - 1;
    const { data, error } = await load(from, to);
    if (error) throw new Error(error.message);
    const rows = data || [];
    all.push(...rows);
    if (rows.length < to - from + 1) break;
  }
  return all;
}
