import { Resend } from "resend";
import { supabaseService } from "@/lib/apiAuth";
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

export async function runMessageSummaries(options?: {
  forceConversationId?: string;
  now?: Date;
}): Promise<{ sent: number; skipped: number; errors: string[] }> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: 0, skipped: 0, errors: ["RESEND_API_KEY missing"] };
  }
  return deliverSummaries({
    store: createSupabaseSummaryStore(),
    send: sendWithResend,
    now: options?.now,
    quietMinutes: quietMinutesFromEnv(process.env.MESSAGE_SUMMARY_QUIET_MINUTES),
    forceConversationId: options?.forceConversationId,
    siteUrl: siteUrl(),
  });
}
