import { NextResponse } from "next/server";
import { requireAdmin, supabaseService } from "@/lib/apiAuth";
import { ilikePattern, pageBounds, parsePositiveInt } from "@/lib/adminPaging";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MESSAGE_LIMIT_DEFAULT = 80;
const MESSAGE_LIMIT_MAX = 100;

const CONVERSATION_COLUMNS =
  "id, influencer_id, influencer_name, influencer_email, brand_email, brand_name, proposal_id, created_at, last_message_at, closed_at";
const MESSAGE_COLUMNS =
  "id, conversation_id, sender_id, sender_type, content, attachments, read, sent_via_email, created_at";

/**
 * Admin read of brand↔influencer threads. Lists are one page; a thread loads a
 * bounded message window. This route never updates messages, presence, or email_sent.
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

    const focusId = (url.searchParams.get("id") || "").trim();
    if (focusId && !url.searchParams.get("conversationId")) {
      const { data, error } = await db
        .from("conversations")
        .select(CONVERSATION_COLUMNS)
        .eq("id", focusId)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, conversation: data });
    }

    const conversationId = (url.searchParams.get("conversationId") || "").trim();
    if (conversationId) {
      const limit = Math.min(
        MESSAGE_LIMIT_MAX,
        parsePositiveInt(url.searchParams.get("limit"), MESSAGE_LIMIT_DEFAULT)
      );
      const before = (url.searchParams.get("before") || "").trim();
      let messageQuery = db
        .from("messages")
        .select(MESSAGE_COLUMNS)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(limit + 1);
      if (before) messageQuery = messageQuery.lt("created_at", before);

      const [{ data, error }, conversationResult] = await Promise.all([
        messageQuery,
        db
          .from("conversations")
          .select("influencer_name, brand_name, brand_email")
          .eq("id", conversationId)
          .maybeSingle(),
      ]);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const raw = data || [];
      const hasMore = raw.length > limit;
      const conv = conversationResult.data;
      const messages = raw.slice(0, limit).reverse().map((row) => {
        const senderType = String((row as { sender_type?: string }).sender_type || "");
        const isCreator = senderType === "influencer";
        return {
          ...row,
          sender_name: isCreator
            ? conv?.influencer_name || ""
            : conv?.brand_name || conv?.brand_email || "",
          sender_role: isCreator ? "creator" : "brand",
        };
      });
      return NextResponse.json({ success: true, messages, hasMore });
    }

    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      parsePositiveInt(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE)
    );
    const q = (url.searchParams.get("q") || "").trim();
    const status = (url.searchParams.get("status") || "all").toLowerCase();
    const newerThan = (url.searchParams.get("newerThan") || "").trim();
    const { from, to } = pageBounds(page, pageSize);

    let listQuery = db
      .from("conversations")
      .select(CONVERSATION_COLUMNS, { count: "exact" })
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .range(from, to);

    if (status === "open") listQuery = listQuery.is("closed_at", null);
    else if (status === "closed") listQuery = listQuery.not("closed_at", "is", null);

    if (q) {
      const pattern = ilikePattern(q);
      listQuery = listQuery.or(
        `influencer_name.ilike.${pattern},influencer_email.ilike.${pattern},brand_name.ilike.${pattern},brand_email.ilike.${pattern}`
      );
    }

    const newerQuery =
      newerThan && !Number.isNaN(Date.parse(newerThan))
        ? db
            .from("conversations")
            .select("id", { count: "exact", head: true })
            .gt("last_message_at", newerThan)
        : null;

    const [listResult, totalCount, openCount, closedCount, newerResult] = await Promise.all([
      listQuery,
      db.from("conversations").select("id", { count: "exact", head: true }),
      db.from("conversations").select("id", { count: "exact", head: true }).is("closed_at", null),
      db.from("conversations").select("id", { count: "exact", head: true }).not("closed_at", "is", null),
      newerQuery,
    ]);

    if (listResult.error) return NextResponse.json({ error: listResult.error.message }, { status: 500 });

    const total = listResult.count ?? 0;
    return NextResponse.json(
      {
        success: true,
        conversations: listResult.data || [],
        page,
        pageSize,
        total,
        hasMore: page * pageSize < total,
        counts: {
          total: totalCount.count ?? 0,
          open: openCount.count ?? 0,
          closed: closedCount.count ?? 0,
        },
        newerCount: newerResult && !newerResult.error ? newerResult.count ?? 0 : 0,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load conversations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
