import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMissingRelation,
  legacyThread,
  type SupportAttachment,
  type SupportMessage,
  type SupportTicketRow,
} from "@/lib/supportThread";

type QueryError = { code?: string; message?: string } | null;

export async function loadTicketMessages(
  supabase: SupabaseClient,
  ticket: SupportTicketRow
): Promise<{ messages: SupportMessage[]; threaded: boolean }> {
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .select("id, ticket_id, sender_role, sender_id, body, attachments, created_at")
    .eq("ticket_id", ticket.id)
    .order("created_at", { ascending: true });

  if (isMissingRelation(error as QueryError)) {
    return { messages: legacyThread(ticket), threaded: false };
  }
  if (error) throw error;
  if (!data || data.length === 0) return { messages: legacyThread(ticket), threaded: true };
  return { messages: data as SupportMessage[], threaded: true };
}

export async function insertTicketMessage(
  supabase: SupabaseClient,
  message: {
    ticket_id: string;
    sender_role: "user" | "admin";
    sender_id: string | null;
    body: string;
    attachments?: SupportAttachment[];
    created_at?: string;
  }
): Promise<boolean> {
  const { error } = await supabase.from("support_ticket_messages").insert({
    ticket_id: message.ticket_id,
    sender_role: message.sender_role,
    sender_id: message.sender_id,
    body: message.body,
    attachments: message.attachments || [],
    ...(message.created_at ? { created_at: message.created_at } : {}),
  });
  if (isMissingRelation(error as QueryError)) return false;
  if (error) throw error;
  return true;
}
