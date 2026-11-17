import { NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { isChatParticipant, loadChatActor, senderIdFor } from "@/lib/chatActor";
import {
  deliverableTipContent,
  extractPublishableDeliverableUrl,
  looksLikeDeliverableLink,
  DELIVERABLE_TIP_MARKER,
  type DeliverableTipTarget,
} from "@/lib/deliverableChatTip";
import {
  looksLikeOffPlatformContact,
  offPlatformTipContent,
  OFF_PLATFORM_TIP_MARKER,
} from "@/lib/offPlatformContact";
import { isAdminConversationKind } from "@/lib/adminChat";
import { notifyAdminOfUserReply } from "@/lib/adminChatNotify";
import { deferAfterResponse, pushParty } from "@/lib/proposalNotify";

type Attachment = { url: string; filename?: string; size?: number; content_type?: string };
type SenderType = "influencer" | "brand";

async function resolveDeliverableTipTarget(args: {
  conversationId: string;
  userText: string;
}): Promise<DeliverableTipTarget | null> {
  const admin = supabaseService();
  const prefill = extractPublishableDeliverableUrl(args.userText) || undefined;
  const { data: conv } = await admin
    .from("conversations")
    .select("id, proposal_id, influencer_id, brand_email")
    .eq("id", args.conversationId)
    .maybeSingle();
  if (!conv) {
    return prefill ? { prefill } : null;
  }

  const proposalId = conv.proposal_id != null ? String(conv.proposal_id) : "";
  if (proposalId) {
    const { data: prop } = await admin
      .from("proposals")
      .select("id, influencer_agreement_accepted, brand_agreement_accepted")
      .eq("id", proposalId)
      .maybeSingle();
    if (prop?.influencer_agreement_accepted && prop?.brand_agreement_accepted) {
      return { kind: "proposal", id: String(prop.id), prefill };
    }
  }

  const influencerId = String(conv.influencer_id || "");
  const brandEmail = String(conv.brand_email || "").trim().toLowerCase();
  if (influencerId && brandEmail) {
    const { data: apps } = await admin
      .from("campaign_applications")
      .select("id, status, created_at, brand_campaigns ( brands ( contact_email ) )")
      .eq("influencer_id", influencerId)
      .in("status", ["shortlisted", "accepted", "completed"])
      .order("created_at", { ascending: false })
      .limit(8);
    for (const app of apps || []) {
      const campaignRaw = app.brand_campaigns as unknown;
      const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as {
        brands?: { contact_email?: string } | { contact_email?: string }[] | null;
      } | null;
      const brandRow = Array.isArray(campaign?.brands) ? campaign?.brands[0] : campaign?.brands;
      const email = (brandRow?.contact_email || "").trim().toLowerCase();
      if (email && email === brandEmail) {
        return { kind: "campaign", id: String(app.id), prefill };
      }
    }
  }

  if (proposalId) return { kind: "proposal", id: proposalId, prefill };
  return prefill ? { prefill } : null;
}

/** Soft tip: paste publishable link in Παραδοτέο. At most one per 12h. Never blocks. */
async function maybeInsertDeliverableTip(args: {
  conversationId: string;
  senderId: string;
  senderType: SenderType;
  userText: string;
}): Promise<Record<string, unknown> | null> {
  if (!looksLikeDeliverableLink(args.userText)) return null;
  const admin = supabaseService();
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await admin
    .from("messages")
    .select("id, content")
    .eq("conversation_id", args.conversationId)
    .gte("created_at", since)
    .like("content", `${DELIVERABLE_TIP_MARKER}%`)
    .limit(1);
  if (recent && recent.length > 0) return null;

  const target = await resolveDeliverableTipTarget({
    conversationId: args.conversationId,
    userText: args.userText,
  });
  const tip = await insertMessage({
    conversation_id: args.conversationId,
    sender_id: args.senderId,
    sender_type: args.senderType,
    content: deliverableTipContent(target),
    read: false,
    sent_via_email: false,
    email_sent: false,
    admin_notified: false,
  });
  if (tip.error || !tip.data) return null;
  return tip.data as Record<string, unknown>;
}

/** Soft in-thread notice after an off-platform contact prompt. At most one per 12h. */
async function maybeInsertOffPlatformTip(args: {
  conversationId: string;
  senderId: string;
  senderType: SenderType;
  userText: string;
}): Promise<Record<string, unknown> | null> {
  // Prefer deliverable tip when the message is a file-host / publishable post link.
  if (looksLikeDeliverableLink(args.userText)) return null;
  if (!looksLikeOffPlatformContact(args.userText)) return null;
  const admin = supabaseService();
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await admin
    .from("messages")
    .select("id, content")
    .eq("conversation_id", args.conversationId)
    .gte("created_at", since)
    .like("content", `${OFF_PLATFORM_TIP_MARKER}%`)
    .limit(1);
  if (recent && recent.length > 0) return null;

  const tip = await insertMessage({
    conversation_id: args.conversationId,
    sender_id: args.senderId,
    sender_type: args.senderType,
    content: offPlatformTipContent(),
    read: false,
    sent_via_email: false,
    email_sent: false,
    admin_notified: false,
  });
  if (tip.error || !tip.data) return null;
  return tip.data as Record<string, unknown>;
}

function cleanAttachments(raw: unknown): Attachment[] {
  if (!Array.isArray(raw)) return [];
  const out: Attachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const url = String((item as { url?: string }).url || "");
    if (!/^https:\/\//i.test(url)) continue;
    const filename = (item as { filename?: unknown }).filename;
    const size = (item as { size?: unknown }).size;
    const contentType = (item as { content_type?: unknown }).content_type;
    out.push({
      url,
      filename: typeof filename === "string" ? filename.slice(0, 120) : undefined,
      size: typeof size === "number" ? size : undefined,
      content_type: typeof contentType === "string" ? contentType.slice(0, 80) : undefined,
    });
    if (out.length >= 5) break;
  }
  return out;
}

async function influencerContact(influencerId: string): Promise<{ name: string; email: string | null }> {
  const admin = supabaseService();
  const nameRow = await admin.from("influencers").select("display_name").eq("id", influencerId).maybeSingle();
  const priv = await admin.from("influencer_private").select("contact_email").eq("influencer_id", influencerId).maybeSingle();
  const fromPrivate = !priv.error && typeof priv.data?.contact_email === "string" ? priv.data.contact_email.trim() : "";
  if (fromPrivate) {
    return { name: nameRow.data?.display_name || "Influencer", email: fromPrivate };
  }
  const legacy = await admin.from("influencers").select("display_name, contact_email").eq("id", influencerId).maybeSingle();
  const email = typeof legacy.data?.contact_email === "string" ? legacy.data.contact_email.trim() : "";
  return {
    name: legacy.data?.display_name || nameRow.data?.display_name || "Influencer",
    email: email || null,
  };
}

async function insertMessage(row: Record<string, unknown>) {
  const admin = supabaseService();
  const payload: Record<string, unknown> = { ...row };
  let lastError = "Insert failed";
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await admin.from("messages").insert([payload]).select().single();
    if (!result.error) return { data: result.data, error: null as string | null };
    lastError = result.error.message || lastError;
    if (/attachments/i.test(lastError) && "attachments" in payload) {
      delete payload.attachments;
      if (!String(payload.content || "").trim()) payload.content = "📎 Συνημμένο";
      continue;
    }
    if (/email_sent/i.test(lastError) && "email_sent" in payload) {
      delete payload.email_sent;
      continue;
    }
    if (/admin_notified/i.test(lastError) && "admin_notified" in payload) {
      delete payload.admin_notified;
      continue;
    }
    if (/sent_via_email/i.test(lastError) && "sent_via_email" in payload) {
      delete payload.sent_via_email;
      continue;
    }
    break;
  }
  return { data: null, error: lastError };
}

function threadUrl(senderType: SenderType, conversationId: string): string {
  const id = encodeURIComponent(conversationId);
  if (senderType === "influencer") return `/brand/dashboard?tab=messages&conversation=${id}`;
  return `/dashboard?tab=messages&conversation=${id}`;
}

async function notifyPush(args: {
  senderType: SenderType;
  conversationId: string;
  preview: string;
  influencerId: string;
  influencerName: string;
  brandEmail: string;
  brandName: string;
  skipBecauseProposal: boolean;
}) {
  if (args.skipBecauseProposal) return;
  const text = args.preview.slice(0, 60) + (args.preview.length > 60 ? "…" : "");
  const toBrand = args.senderType === "influencer";
  await pushParty({
    type: "message",
    side: toBrand ? "brand" : "influencer",
    influencerId: args.influencerId,
    brandEmail: args.brandEmail,
    conversationId: args.conversationId,
    payload: toBrand
      ? {
          title: "💬 Νέο μήνυμα",
          body: `${args.influencerName}: ${text}`,
          url: threadUrl("influencer", args.conversationId),
          tag: `message-brand-${args.conversationId}`,
        }
      : {
          title: "💬 Νέο μήνυμα",
          body: `${args.brandName}: ${text}`,
          url: threadUrl("brand", args.conversationId),
          tag: `message-inf-${args.conversationId}`,
        },
  });
}

async function track(influencerId: string, eventType: string, brandEmail: string | null, brandName: string | null, metadata: Record<string, unknown>) {
  try {
    await supabaseService().from("influencer_analytics").insert([
      {
        influencer_id: influencerId,
        event_type: eventType,
        brand_email: brandEmail,
        brand_name: brandName,
        metadata,
      },
    ]);
  } catch {
    /* analytics must not block chat */
  }
}

export async function POST(req: Request) {
  try {
    const user = await userFromBearer(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const actor = await loadChatActor(user);

    const body = await req.json().catch(() => ({}));
    const senderType = body.senderType === "brand" || body.senderType === "influencer" ? (body.senderType as SenderType) : null;
    if (!senderType) return NextResponse.json({ error: "Invalid sender" }, { status: 400 });
    if (senderType === "influencer" && !actor.influencerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (senderType === "brand" && !actor.brandEmail) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const messageContent = typeof body.content === "string" ? body.content.slice(0, 5000) : "";
    const messageAttachments = cleanAttachments(body.attachments);
    const contentForNotify =
      messageContent.trim() ||
      (messageAttachments[0]?.filename ? `📎 ${messageAttachments[0].filename}` : messageAttachments.length ? "📎 Συνημμένο" : "");
    if (!messageContent.trim() && messageAttachments.length === 0) {
      return NextResponse.json({ error: "Message content or attachments required" }, { status: 400 });
    }

    const proposalId = body.proposalId || null;
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";

    if (!conversationId) {
      const influencerId = senderType === "influencer" ? actor.influencerId : String(body.influencerId || "");
      if (!influencerId) return NextResponse.json({ error: "Influencer not found" }, { status: 404 });
      if (senderType === "influencer" && influencerId !== actor.influencerId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const brandEmail =
        senderType === "brand" ? actor.brandEmail! : String(body.brandEmail || "").toLowerCase().trim();
      if (!brandEmail || !brandEmail.includes("@")) {
        return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
      }
      const brandName =
        senderType === "brand"
          ? actor.brandName || brandEmail
          : typeof body.brandName === "string" && body.brandName.trim()
            ? body.brandName.trim().slice(0, 120)
            : brandEmail;

      const admin = supabaseService();
      const { data: existingRows } = await admin
        .from("conversations")
        .select("id, closed_at, influencer_id, brand_email, conversation_kind")
        .eq("influencer_id", influencerId)
        .ilike("brand_email", brandEmail)
        .limit(1);
      const existingConv = existingRows?.[0];

      let convId = existingConv?.id as string | undefined;
      if (convId && existingConv?.closed_at) {
        await admin.from("conversations").update({ closed_at: null }).eq("id", convId);
      }

      if (!convId) {
        const influencer = await influencerContact(influencerId);
        if (!influencer.name && !influencer.email) {
          const exists = await admin.from("influencers").select("id").eq("id", influencerId).maybeSingle();
          if (!exists.data) return NextResponse.json({ error: "Influencer not found" }, { status: 404 });
        }
        const profile = await admin.from("influencers").select("id, display_name").eq("id", influencerId).maybeSingle();
        if (!profile.data) return NextResponse.json({ error: "Influencer not found" }, { status: 404 });
        const { data: newConv, error: convError } = await admin
          .from("conversations")
          .insert([
            {
              influencer_id: influencerId,
              influencer_name: profile.data.display_name,
              influencer_email: influencer.email || "",
              brand_email: brandEmail,
              brand_name: brandName,
              proposal_id: proposalId || null,
            },
          ])
          .select("id")
          .single();
        if (convError || !newConv) return NextResponse.json({ error: convError?.message || "Could not open conversation" }, { status: 500 });
        convId = newConv.id;
        await track(influencerId, "conversation_started", brandEmail, brandName, {
          conversation_id: convId,
          source: "messages_api",
        });
      } else if (!isChatParticipant(actor, { influencer_id: influencerId, brand_email: brandEmail })) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const senderId = senderIdFor(actor, senderType, { influencer_id: influencerId, brand_email: brandEmail });
      const inserted = await insertMessage({
        conversation_id: convId,
        sender_id: senderId,
        sender_type: senderType,
        content: messageContent,
        attachments: messageAttachments,
        read: false,
        sent_via_email: false,
        email_sent: false,
        admin_notified: false,
      });
      if (inserted.error || !inserted.data) return NextResponse.json({ error: inserted.error || "Insert failed" }, { status: 500 });

      const now = new Date().toISOString();
      const updateField = senderType === "influencer" ? "last_activity_influencer" : "last_activity_brand";
      await admin
        .from("conversations")
        .update({ last_message_at: now, [updateField]: now, closed_at: null })
        .eq("id", convId);

      const influencerName =
        (await admin.from("influencers").select("display_name").eq("id", influencerId).maybeSingle()).data?.display_name ||
        "Influencer";
      deferAfterResponse(() =>
        notifyPush({
          senderType,
          conversationId: convId!,
          preview: contentForNotify,
          influencerId,
          influencerName,
          brandEmail,
          brandName,
          skipBecauseProposal: senderType === "brand" && !!proposalId,
        })
      );
      await track(influencerId, "message_sent", brandEmail, brandName, {
        conversation_id: convId,
        source: "messages_api",
        sender_type: senderType,
      });
      let safetyTip: Record<string, unknown> | null = null;
      if (senderId) {
        safetyTip = await maybeInsertDeliverableTip({
          conversationId: convId!,
          senderId,
          senderType,
          userText: messageContent,
        });
        if (!safetyTip) {
          safetyTip = await maybeInsertOffPlatformTip({
            conversationId: convId!,
            senderId,
            senderType,
            userText: messageContent,
          });
        }
      }
      return NextResponse.json({
        success: true,
        message: inserted.data,
        conversationId: convId,
        ...(safetyTip ? { safetyTip } : {}),
      });
    }

    const admin = supabaseService();
    const { data: conv } = await admin
      .from("conversations")
      .select("id, conversation_kind, influencer_id, influencer_name, brand_email, brand_name, proposal_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    const adminThread = isAdminConversationKind(
      typeof conv.conversation_kind === "string" ? conv.conversation_kind : null
    );
    if (
      !isChatParticipant(actor, conv) ||
      (senderType === "influencer" && actor.influencerId !== conv.influencer_id) ||
      (senderType === "brand" &&
        actor.brandEmail !== String(conv.brand_email || "").toLowerCase().trim())
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (adminThread) {
      if (senderType === "influencer" && !conv.influencer_id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (senderType === "brand" && !conv.brand_email) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const senderId = senderIdFor(actor, senderType, conv);
    let replyToId: string | null = null;
    if (typeof body.replyToId === "string" && /^[0-9a-f-]{36}$/i.test(body.replyToId)) {
      const { data: parent } = await admin.from("messages").select("id").eq("id", body.replyToId).eq("conversation_id", conversationId).maybeSingle();
      replyToId = parent?.id ?? null;
    }
    const inserted = await insertMessage({
      ...(replyToId ? { reply_to_id: replyToId } : {}),
      conversation_id: conversationId,
      sender_id: senderId,
      sender_type: senderType,
      content: messageContent,
      attachments: messageAttachments,
      read: false,
      sent_via_email: false,
      email_sent: false,
      admin_notified: adminThread ? true : false,
    });
    if (inserted.error || !inserted.data) return NextResponse.json({ error: inserted.error || "Insert failed" }, { status: 500 });

    const now = new Date().toISOString();
    const updateField = senderType === "influencer" ? "last_activity_influencer" : "last_activity_brand";
    await admin
      .from("conversations")
      .update({ last_message_at: now, [updateField]: now, closed_at: null })
      .eq("id", conversationId);

    if (adminThread) {
      const fromName =
        senderType === "influencer"
          ? conv.influencer_name || "Influencer"
          : conv.brand_name || String(conv.brand_email || "Brand");
      deferAfterResponse(() =>
        notifyAdminOfUserReply({
          conversationId,
          preview: contentForNotify,
          fromName,
        })
      );
    } else {
      deferAfterResponse(() =>
        notifyPush({
          senderType,
          conversationId,
          preview: contentForNotify,
          influencerId: String(conv.influencer_id || ""),
          influencerName: conv.influencer_name || "Influencer",
          brandEmail: String(conv.brand_email || ""),
          brandName: conv.brand_name || "Επιχείρηση",
          skipBecauseProposal: false,
        })
      );
      if (conv.influencer_id) {
        await track(String(conv.influencer_id), "message_sent", conv.brand_email, conv.brand_name, {
          conversation_id: conversationId,
          source: "messages_api",
          sender_type: senderType,
        });
      }
    }

    let safetyTip: Record<string, unknown> | null = null;
    if (senderId && !adminThread) {
      safetyTip = await maybeInsertDeliverableTip({
        conversationId,
        senderId,
        senderType,
        userText: messageContent,
      });
      if (!safetyTip) {
        safetyTip = await maybeInsertOffPlatformTip({
          conversationId,
          senderId,
          senderType,
          userText: messageContent,
        });
      }
    }
    return NextResponse.json({
      success: true,
      message: inserted.data,
      ...(safetyTip ? { safetyTip } : {}),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Message API error";
    console.error("Message API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const user = await userFromBearer(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const actor = await loadChatActor(user);
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const influencerId = searchParams.get("influencerId");
    const brandEmail = searchParams.get("brandEmail");
    const admin = supabaseService();

    if (conversationId) {
      const { data: conv } = await admin
        .from("conversations")
        .select("id, influencer_id, brand_email, conversation_kind")
        .eq("id", conversationId)
        .maybeSingle();
      if (!conv || !isChatParticipant(actor, conv)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { data: messages, error } = await admin
        .from("messages")
        .select("id, conversation_id, sender_id, sender_type, content, attachments, read, created_at, reply_to_id, read_at, pinned_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ messages });
    }

    if (influencerId && brandEmail) {
      if (!isChatParticipant(actor, { influencer_id: influencerId, brand_email: brandEmail })) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { data: conversation } = await admin
        .from("conversations")
        .select("id")
        .eq("influencer_id", influencerId)
        .ilike("brand_email", brandEmail)
        .maybeSingle();
      if (!conversation) return NextResponse.json({ messages: [], conversationId: null });
      const { data: messages, error } = await admin
        .from("messages")
        .select("id, conversation_id, sender_id, sender_type, content, attachments, read, created_at, reply_to_id, read_at, pinned_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ messages, conversationId: conversation.id });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Message GET error";
    console.error("Message GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
