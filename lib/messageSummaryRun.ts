import { Resend } from "resend";
import { supabaseService } from "@/lib/apiAuth";
import {
  adminInboxAddress,
  deliverAdminSummaries,
  type AdminConversation,
  type AdminSummaryMessage,
  type AdminSummaryStore,
} from "@/lib/adminMessageSummary";
import {
  deliverSummaries,
  quietMinutesFromEnv,
  type SummaryConversation,
  type SummaryMessage,
  type SummaryStore,
} from "@/lib/messageSummary";

const FROM = "Influo <noreply@influo.gr>";

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://influo.gr").replace(/\/$/, "");
}

function asMessage(row: Record<string, unknown>): SummaryMessage | null {
  if (!row.id || !row.conversation_id) return null;
  const sender = row.sender_type === "brand" ? "brand" : row.sender_type === "influencer" ? "influencer" : null;
  if (!sender) return null;
  return {
    id: String(row.id),
    conversation_id: String(row.conversation_id),
    sender_type: sender,
    content: typeof row.content === "string" ? row.content : "",
    created_at: typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString(),
    read: row.read === true,
    email_sent: row.email_sent === true,
  };
}

function asConversation(row: Record<string, unknown>): SummaryConversation | null {
  if (!row.id || !row.influencer_id) return null;
  return {
    id: String(row.id),
    influencer_id: String(row.influencer_id),
    influencer_name: typeof row.influencer_name === "string" ? row.influencer_name : null,
    influencer_email: typeof row.influencer_email === "string" ? row.influencer_email : null,
    brand_email: typeof row.brand_email === "string" ? row.brand_email : null,
    brand_name: typeof row.brand_name === "string" ? row.brand_name : null,
    last_message_at: typeof row.last_message_at === "string" ? row.last_message_at : null,
  };
}

export function createSupabaseSummaryStore(): SummaryStore {
  const admin = supabaseService();
  const messageSelect = "id, conversation_id, sender_type, content, created_at, read, email_sent";

  return {
    async listPending(limit: number) {
      const { data, error } = await admin
        .from("messages")
        .select(messageSelect)
        .eq("read", false)
        .eq("email_sent", false)
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data || []).map((row) => asMessage(row as Record<string, unknown>)).filter((m): m is SummaryMessage => !!m);
    },
    async listPendingForConversation(conversationId: string) {
      const { data, error } = await admin
        .from("messages")
        .select(messageSelect)
        .eq("conversation_id", conversationId)
        .eq("read", false)
        .eq("email_sent", false)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw new Error(error.message);
      return (data || []).map((row) => asMessage(row as Record<string, unknown>)).filter((m): m is SummaryMessage => !!m);
    },
    async listConversations(ids: string[]) {
      if (!ids.length) return [];
      const { data, error } = await admin
        .from("conversations")
        .select("id, influencer_id, influencer_name, influencer_email, brand_email, brand_name, last_message_at")
        .in("id", ids);
      if (error) throw new Error(error.message);
      return (data || [])
        .map((row) => asConversation(row as Record<string, unknown>))
        .filter((c): c is SummaryConversation => !!c);
    },
    async claim(ids: string[]) {
      if (!ids.length) return [];
      const { data, error } = await admin
        .from("messages")
        .update({ email_sent: true })
        .in("id", ids)
        .eq("read", false)
        .eq("email_sent", false)
        .select("id");
      if (error) throw new Error(error.message);
      return (data || []).map((row) => String((row as { id: string }).id));
    },
    async release(ids: string[]) {
      if (!ids.length) return;
      const { error } = await admin.from("messages").update({ email_sent: false }).in("id", ids);
      if (error) throw new Error(error.message);
    },
    async influencerEmail(influencerId: string, fallback: string | null) {
      const priv = await admin
        .from("influencer_private")
        .select("contact_email")
        .eq("influencer_id", influencerId)
        .maybeSingle();
      const fromPrivate = !priv.error && typeof priv.data?.contact_email === "string" ? priv.data.contact_email.trim() : "";
      if (fromPrivate) return fromPrivate;
      const legacy = await admin.from("influencers").select("contact_email").eq("id", influencerId).maybeSingle();
      const fromLegacy =
        !legacy.error && typeof legacy.data?.contact_email === "string" ? legacy.data.contact_email.trim() : "";
      return fromLegacy || fallback?.trim() || null;
    },
    async brandEmail(conversationEmail: string) {
      const normalized = conversationEmail.toLowerCase().trim();
      if (!normalized) return null;
      const priv = await admin
        .from("brand_private")
        .select("contact_email")
        .ilike("contact_email", normalized)
        .maybeSingle();
      const fromPrivate = !priv.error && typeof priv.data?.contact_email === "string" ? priv.data.contact_email.trim() : "";
      return fromPrivate || normalized;
    },
  };
}

function asAdminMessage(row: Record<string, unknown>): AdminSummaryMessage | null {
  if (!row.id || !row.conversation_id) return null;
  const sender = row.sender_type === "brand" ? "brand" : row.sender_type === "influencer" ? "influencer" : null;
  if (!sender) return null;
  return {
    id: String(row.id),
    conversation_id: String(row.conversation_id),
    sender_type: sender,
    content: typeof row.content === "string" ? row.content : "",
    created_at: typeof row.created_at === "string" ? row.created_at : new Date(0).toISOString(),
    admin_notified: row.admin_notified === true,
  };
}

function asAdminConversation(row: Record<string, unknown>): AdminConversation | null {
  if (!row.id) return null;
  return {
    id: String(row.id),
    influencer_name: typeof row.influencer_name === "string" ? row.influencer_name : null,
    brand_name: typeof row.brand_name === "string" ? row.brand_name : null,
    brand_email: typeof row.brand_email === "string" ? row.brand_email : null,
    last_message_at: typeof row.last_message_at === "string" ? row.last_message_at : null,
    closed_at: typeof row.closed_at === "string" ? row.closed_at : null,
  };
}

export function createSupabaseAdminSummaryStore(): AdminSummaryStore {
  const admin = supabaseService();
  const messageSelect = "id, conversation_id, sender_type, content, created_at, admin_notified";

  return {
    async listUnnotified(limit: number) {
      const { data, error } = await admin
        .from("messages")
        .select(messageSelect)
        .or("admin_notified.eq.false,admin_notified.is.null")
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data || []).map((row) => asAdminMessage(row as Record<string, unknown>)).filter((m): m is AdminSummaryMessage => !!m);
    },
    async listUnnotifiedForConversation(conversationId: string) {
      const { data, error } = await admin
        .from("messages")
        .select(messageSelect)
        .eq("conversation_id", conversationId)
        .or("admin_notified.eq.false,admin_notified.is.null")
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data || []).map((row) => asAdminMessage(row as Record<string, unknown>)).filter((m): m is AdminSummaryMessage => !!m);
    },
    async listConversations(ids: string[]) {
      if (!ids.length) return [];
      const { data, error } = await admin
        .from("conversations")
        .select("id, influencer_name, brand_name, brand_email, last_message_at, closed_at")
        .in("id", ids);
      if (error) throw new Error(error.message);
      return (data || [])
        .map((row) => asAdminConversation(row as Record<string, unknown>))
        .filter((c): c is AdminConversation => !!c);
    },
    async claim(ids: string[]) {
      if (!ids.length) return [];
      const { data, error } = await admin
        .from("messages")
        .update({ admin_notified: true })
        .in("id", ids)
        .or("admin_notified.eq.false,admin_notified.is.null")
        .select("id");
      if (error) throw new Error(error.message);
      return (data || []).map((row) => String((row as { id: string }).id));
    },
    async release(ids: string[]) {
      if (!ids.length) return;
      const { error } = await admin.from("messages").update({ admin_notified: false }).in("id", ids);
      if (error) throw new Error(error.message);
    },
  };
}

async function sendWithResend(mail: { to: string; subject: string; html: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY missing");
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: FROM,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
  });
  if (error) throw new Error(error.message);
}

export type SummaryRunResult = {
  sent: number;
  skipped: number;
  errors: string[];
  adminSent: number;
  adminSkipped: number;
};

async function deliverAdmin(options?: {
  forceConversationId?: string;
  includeClosed?: boolean;
  now?: Date;
}): Promise<{ sent: number; skipped: number; errors: string[] }> {
  return deliverAdminSummaries({
    store: createSupabaseAdminSummaryStore(),
    send: sendWithResend,
    adminEmail: adminInboxAddress(process.env.ADMIN_EMAIL),
    now: options?.now,
    quietMinutes: quietMinutesFromEnv(process.env.MESSAGE_SUMMARY_QUIET_MINUTES),
    forceConversationId: options?.forceConversationId,
    includeClosed: options?.includeClosed,
    siteUrl: siteUrl(),
  });
}

export async function runAdminMessageSummaries(options?: {
  forceConversationId?: string;
  includeClosed?: boolean;
  now?: Date;
}): Promise<{ sent: number; skipped: number; errors: string[] }> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: 0, skipped: 0, errors: ["RESEND_API_KEY missing"] };
  }
  try {
    return await deliverAdmin(options);
  } catch (error) {
    return { sent: 0, skipped: 0, errors: [error instanceof Error ? error.message : String(error)] };
  }
}

export async function runMessageSummaries(options?: {
  forceConversationId?: string;
  now?: Date;
}): Promise<SummaryRunResult> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: 0, skipped: 0, adminSent: 0, adminSkipped: 0, errors: ["RESEND_API_KEY missing"] };
  }
  const participant = await deliverSummaries({
    store: createSupabaseSummaryStore(),
    send: sendWithResend,
    now: options?.now,
    quietMinutes: quietMinutesFromEnv(process.env.MESSAGE_SUMMARY_QUIET_MINUTES),
    forceConversationId: options?.forceConversationId,
    siteUrl: siteUrl(),
  });
  const admin = await runAdminMessageSummaries({
    forceConversationId: options?.forceConversationId,
    now: options?.now,
  });
  return {
    sent: participant.sent,
    skipped: participant.skipped,
    adminSent: admin.sent,
    adminSkipped: admin.skipped,
    errors: [...participant.errors, ...admin.errors],
  };
}
