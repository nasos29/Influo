import { NextResponse } from "next/server";
import { requireAdmin, supabaseService } from "@/lib/apiAuth";
import {
  ADMIN_CHAT_DISPLAY_NAME,
  ADMIN_CHAT_KIND,
  type AdminChatUserType,
} from "@/lib/adminChat";
import { notifyUserOfAdminMessage } from "@/lib/adminChatNotify";
import { deferAfterResponse } from "@/lib/proposalNotify";
import { ilikePattern, pageBounds, parsePositiveInt } from "@/lib/adminPaging";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MESSAGE_LIMIT_DEFAULT = 80;
const MESSAGE_LIMIT_MAX = 100;

const CONV_COLS =
  "id, conversation_kind, influencer_id, influencer_name, influencer_email, brand_email, brand_name, created_at, last_message_at, closed_at, last_activity_admin";
const MSG_COLS =
  "id, conversation_id, sender_id, sender_type, content, attachments, read, created_at, reply_to_id";

function normEmail(value: string | null | undefined): string {
  return (value || "").toLowerCase().trim();
}

async function influencerContact(influencerId: string): Promise<{ name: string; email: string }> {
  const admin = supabaseService();
  const nameRow = await admin.from("influencers").select("display_name").eq("id", influencerId).maybeSingle();
  const priv = await admin
    .from("influencer_private")
    .select("contact_email")
    .eq("influencer_id", influencerId)
    .maybeSingle();
  const fromPrivate =
    !priv.error && typeof priv.data?.contact_email === "string" ? priv.data.contact_email.trim() : "";
  if (fromPrivate) {
    return { name: nameRow.data?.display_name || "Influencer", email: fromPrivate };
  }
  const legacy = await admin
    .from("influencers")
    .select("display_name, contact_email")
    .eq("id", influencerId)
    .maybeSingle();
  return {
    name: legacy.data?.display_name || nameRow.data?.display_name || "Influencer",
    email: typeof legacy.data?.contact_email === "string" ? legacy.data.contact_email.trim() : "",
  };
}

async function brandContact(brandId: string): Promise<{ name: string; email: string } | null> {
  const admin = supabaseService();
  const brand = await admin.from("brands").select("id, brand_name").eq("id", brandId).maybeSingle();
  if (!brand.data?.id) return null;
  const priv = await admin.from("brand_private").select("contact_email").eq("brand_id", brandId).maybeSingle();
  let email =
    !priv.error && typeof priv.data?.contact_email === "string" ? priv.data.contact_email.trim() : "";
  if (!email) {
    const legacy = await admin.from("brands").select("contact_email").eq("id", brandId).maybeSingle();
    email = typeof legacy.data?.contact_email === "string" ? legacy.data.contact_email.trim() : "";
  }
  if (!email.includes("@")) return null;
  return { name: brand.data.brand_name || email, email: normEmail(email) };
}

async function findAdminThread(args: {
  userType: AdminChatUserType;
  influencerId?: string | null;
  brandEmail?: string | null;
}) {
  const admin = supabaseService();
  if (args.userType === "influencer" && args.influencerId) {
    const { data } = await admin
      .from("conversations")
      .select(CONV_COLS)
      .eq("conversation_kind", ADMIN_CHAT_KIND)
      .eq("influencer_id", args.influencerId)
      .limit(1);
    return data?.[0] || null;
  }
  const email = normEmail(args.brandEmail);
  if (args.userType === "brand" && email) {
    const { data } = await admin
      .from("conversations")
      .select(CONV_COLS)
      .eq("conversation_kind", ADMIN_CHAT_KIND)
      .is("influencer_id", null)
      .ilike("brand_email", email)
      .limit(1);
    return data?.[0] || null;
  }
  return null;
}

async function ensureAdminThread(args: {
  userType: AdminChatUserType;
  userId: string;
}): Promise<{ conversation: Record<string, unknown>; created: boolean } | { error: string; status: number }> {
  const admin = supabaseService();
  if (args.userType === "influencer") {
    const contact = await influencerContact(args.userId);
    const exists = await admin.from("influencers").select("id").eq("id", args.userId).maybeSingle();
    if (!exists.data) return { error: "Influencer not found", status: 404 };
    const existing = await findAdminThread({ userType: "influencer", influencerId: args.userId });
    if (existing) return { conversation: existing as Record<string, unknown>, created: false };
    const { data, error } = await admin
      .from("conversations")
      .insert([
        {
          conversation_kind: ADMIN_CHAT_KIND,
          influencer_id: args.userId,
          influencer_name: contact.name,
          influencer_email: contact.email || "",
          brand_email: null,
          brand_name: ADMIN_CHAT_DISPLAY_NAME,
          proposal_id: null,
        },
      ])
      .select(CONV_COLS)
      .single();
    if (error || !data) return { error: error?.message || "Could not open conversation", status: 500 };
    return { conversation: data as Record<string, unknown>, created: true };
  }

  const contact = await brandContact(args.userId);
  if (!contact) return { error: "Brand not found", status: 404 };
  const existing = await findAdminThread({ userType: "brand", brandEmail: contact.email });
  if (existing) return { conversation: existing as Record<string, unknown>, created: false };
  const { data, error } = await admin
    .from("conversations")
    .insert([
      {
        conversation_kind: ADMIN_CHAT_KIND,
        influencer_id: null,
        influencer_name: ADMIN_CHAT_DISPLAY_NAME,
        influencer_email: "",
        brand_email: contact.email,
        brand_name: contact.name,
        proposal_id: null,
      },
    ])
    .select(CONV_COLS)
    .single();
  if (error || !data) return { error: error?.message || "Could not open conversation", status: 500 };
  return { conversation: data as Record<string, unknown>, created: true };
}

/** List / open admin↔user threads. Peer brand↔influencer chats stay read-only elsewhere. */
export async function GET(request: Request) {
  try {
    const adminUser = await requireAdmin(request);
    if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL(request.url);
    const db = supabaseService();

    const conversationId = (url.searchParams.get("conversationId") || "").trim();
    if (conversationId) {
      const limit = Math.min(
        MESSAGE_LIMIT_MAX,
        parsePositiveInt(url.searchParams.get("limit"), MESSAGE_LIMIT_DEFAULT)
      );
      const before = (url.searchParams.get("before") || "").trim();
      let messageQuery = db
        .from("messages")
        .select(MSG_COLS)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(limit + 1);
      if (before) messageQuery = messageQuery.lt("created_at", before);

      const [{ data, error }, convResult] = await Promise.all([
        messageQuery,
        db.from("conversations").select(CONV_COLS).eq("id", conversationId).maybeSingle(),
      ]);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!convResult.data || convResult.data.conversation_kind !== ADMIN_CHAT_KIND) {
        return NextResponse.json({ error: "Not an admin chat" }, { status: 404 });
      }
      const raw = data || [];
      const hasMore = raw.length > limit;
      const messages = raw.slice(0, limit).reverse().map((row) => {
        const senderType = String((row as { sender_type?: string }).sender_type || "");
        const senderName =
          senderType === "admin"
            ? ADMIN_CHAT_DISPLAY_NAME
            : senderType === "influencer"
              ? convResult.data?.influencer_name || ""
              : convResult.data?.brand_name || convResult.data?.brand_email || "";
        return { ...row, sender_name: senderName };
      });
      await db
        .from("conversations")
        .update({ last_activity_admin: new Date().toISOString() })
        .eq("id", conversationId);
      return NextResponse.json({ success: true, conversation: convResult.data, messages, hasMore });
    }

    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      parsePositiveInt(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE)
    );
    const q = (url.searchParams.get("q") || "").trim();
    const { from, to } = pageBounds(page, pageSize);

    let listQuery = db
      .from("conversations")
      .select(CONV_COLS, { count: "exact" })
      .eq("conversation_kind", ADMIN_CHAT_KIND)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .range(from, to);

    if (q) {
      const pattern = ilikePattern(q);
      listQuery = listQuery.or(
        `influencer_name.ilike.${pattern},influencer_email.ilike.${pattern},brand_name.ilike.${pattern},brand_email.ilike.${pattern}`
      );
    }

    const listResult = await listQuery;
    if (listResult.error) return NextResponse.json({ error: listResult.error.message }, { status: 500 });

    return NextResponse.json(
      {
        success: true,
        conversations: listResult.data || [],
        page,
        pageSize,
        total: listResult.count ?? 0,
        hasMore: page * pageSize < (listResult.count ?? 0),
        displayName: ADMIN_CHAT_DISPLAY_NAME,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin chat GET failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminUser = await requireAdmin(request);
    if (!adminUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "send";
    const db = supabaseService();

    if (action === "open") {
      const userType =
        body.userType === "brand" ? "brand" : body.userType === "influencer" ? "influencer" : null;
      const userId = typeof body.userId === "string" ? body.userId.trim() : "";
      if (!userType || !userId) {
        return NextResponse.json({ error: "userType and userId required" }, { status: 400 });
      }
      const opened = await ensureAdminThread({ userType, userId });
      if ("error" in opened) return NextResponse.json({ error: opened.error }, { status: opened.status });
      return NextResponse.json({
        success: true,
        conversation: opened.conversation,
        created: opened.created,
        displayName: ADMIN_CHAT_DISPLAY_NAME,
      });
    }

    const conversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : "";
    const content = typeof body.content === "string" ? body.content.slice(0, 5000) : "";
    if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    if (!content.trim()) return NextResponse.json({ error: "Message content required" }, { status: 400 });

    const { data: conv } = await db.from("conversations").select(CONV_COLS).eq("id", conversationId).maybeSingle();
    if (!conv || conv.conversation_kind !== ADMIN_CHAT_KIND) {
      return NextResponse.json({ error: "Not an admin chat" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { data: message, error } = await db
      .from("messages")
      .insert([
        {
          conversation_id: conversationId,
          sender_id: adminUser.id,
          sender_type: "admin",
          content,
          read: false,
          sent_via_email: false,
          email_sent: false,
          admin_notified: true,
        },
      ])
      .select(MSG_COLS)
      .single();
    if (error || !message) return NextResponse.json({ error: error?.message || "Insert failed" }, { status: 500 });

    await db
      .from("conversations")
      .update({
        last_message_at: now,
        last_activity_admin: now,
        closed_at: null,
        brand_name: conv.influencer_id ? ADMIN_CHAT_DISPLAY_NAME : conv.brand_name,
        influencer_name: conv.influencer_id ? conv.influencer_name : ADMIN_CHAT_DISPLAY_NAME,
      })
      .eq("id", conversationId);

    deferAfterResponse(() =>
      notifyUserOfAdminMessage({
        conversationId,
        preview: content,
        influencerId: conv.influencer_id ? String(conv.influencer_id) : null,
        brandEmail: conv.brand_email ? normEmail(String(conv.brand_email)) : null,
      })
    );

    return NextResponse.json({
      success: true,
      message: { ...message, sender_name: ADMIN_CHAT_DISPLAY_NAME },
      conversationId,
      displayName: ADMIN_CHAT_DISPLAY_NAME,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin chat POST failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
