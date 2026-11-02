/** Separator written by the old user-reply route into support_tickets.message. */
export const USER_REPLY_SPLIT = "\n\n--- Νέα Απάντηση ---\n";

export type SupportAttachment = {
  url: string;
  filename?: string;
  size?: number;
  content_type?: string;
  uploaded_at?: string;
};

export type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_role: "user" | "admin";
  sender_id: string | null;
  body: string;
  attachments: SupportAttachment[];
  created_at: string;
};

export type SupportTicketRow = {
  id: string;
  user_id?: string | null;
  message?: string | null;
  attachments?: unknown;
  admin_reply?: string | null;
  admin_reply_attachments?: unknown;
  admin_replied_at?: string | null;
  created_at?: string | null;
  status?: string | null;
};

export function isMissingRelation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const code = error.code || "";
  const message = (error.message || "").toLowerCase();
  return code === "42P01"
    || code === "PGRST205"
    || message.includes("does not exist")
    || message.includes("could not find the table")
    || message.includes("schema cache");
}

function asAttachments(value: unknown): SupportAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as SupportAttachment[];
}

function plusSeconds(iso: string, seconds: number): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return iso;
  return new Date(time + seconds * 1000).toISOString();
}

/** Thread reconstructed from the single-reply columns, including appended user replies. */
export function legacyThread(ticket: SupportTicketRow): SupportMessage[] {
  const created = ticket.created_at || new Date(0).toISOString();
  const parts = String(ticket.message || "").split(USER_REPLY_SPLIT);
  const messages: SupportMessage[] = [];
  parts.forEach((part, index) => {
    const body = part.trim();
    if (!body && index > 0) return;
    messages.push({
      id: `legacy-user-${ticket.id}-${index}`,
      ticket_id: ticket.id,
      sender_role: "user",
      sender_id: ticket.user_id || null,
      body,
      attachments: index === 0 ? asAttachments(ticket.attachments) : [],
      created_at: plusSeconds(created, index),
    });
  });
  const adminBody = (ticket.admin_reply || "").trim();
  if (adminBody) {
    const afterUsers = plusSeconds(created, Math.max(parts.length, 1));
    const repliedAt = ticket.admin_replied_at || afterUsers;
    messages.push({
      id: `legacy-admin-${ticket.id}`,
      ticket_id: ticket.id,
      sender_role: "admin",
      sender_id: null,
      body: adminBody,
      attachments: asAttachments(ticket.admin_reply_attachments),
      created_at: repliedAt,
    });
  }
  return messages.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

export function userHasRepliedSinceAdmin(ticket: SupportTicketRow): boolean {
  return String(ticket.message || "").includes(USER_REPLY_SPLIT) && !(ticket.admin_reply || "").trim();
}

/** Status after an explicit reopen. Last speaker decides answered vs awaiting. */
export function reopenStatus(messages: Pick<SupportMessage, "sender_role">[], hasAdminReply: boolean): "open" | "answered" | "awaiting" {
  const last = messages[messages.length - 1];
  if (!last) return "open";
  if (last.sender_role === "admin") return "answered";
  if (messages.some((message) => message.sender_role === "admin") || hasAdminReply) return "awaiting";
  return "open";
}

export function helpDeskTicketUrl(host: string, ticketId: string): string {
  const bare = host.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${bare}/help-desk?ticket=${encodeURIComponent(ticketId)}`;
}

export const REPLY_ON_SITE_NOTE = {
  el: "Απαντήστε από το Help Desk, όχι με reply σε αυτό το email.",
  en: "Reply from the Help Desk, not by replying to this email.",
} as const;
