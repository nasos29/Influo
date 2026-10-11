/** One admin email per quiet or ended conversation. Independent of read and of email_sent. */

import { clipPreview, conversationIsQuiet, escapeHtml } from "./messageSummary";

export const DEFAULT_ADMIN_EMAIL = "nd.6@hotmail.com";

export type AdminSummaryMessage = {
  id: string;
  conversation_id: string;
  sender_type: "influencer" | "brand";
  content: string;
  created_at: string;
  admin_notified: boolean;
};

export type AdminConversation = {
  id: string;
  influencer_name: string | null;
  brand_name: string | null;
  brand_email: string | null;
  last_message_at: string | null;
  closed_at: string | null;
};

export type AdminSummaryStore = {
  listUnnotified(limit: number): Promise<AdminSummaryMessage[]>;
  listUnnotifiedForConversation(conversationId: string): Promise<AdminSummaryMessage[]>;
  listConversations(ids: string[]): Promise<AdminConversation[]>;
  claim(ids: string[]): Promise<string[]>;
  release(ids: string[]): Promise<void>;
};

export type AdminSummaryMail = {
  to: string;
  subject: string;
  html: string;
  conversationId: string;
  messageIds: string[];
};

/** Same inbox as the old per-message admin copy: ADMIN_EMAIL, otherwise nd.6@hotmail.com. */
export function adminInboxAddress(raw: string | undefined | null): string {
  const value = (raw || "").trim();
  return value || DEFAULT_ADMIN_EMAIL;
}

export function adminConversationLink(siteUrl: string, conversationId: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}/admin?conversation=${encodeURIComponent(conversationId)}`;
}

export function partyLabel(name: string | null | undefined, fallback: string): string {
  const clean = (name || "").trim();
  return clean || fallback;
}

export function adminSummaryReady(
  conversation: AdminConversation,
  options: { now: Date; quietMinutes: number; force: boolean; includeClosed: boolean }
): boolean {
  if (options.force) return true;
  if (options.includeClosed && conversation.closed_at) return true;
  return conversationIsQuiet(conversation.last_message_at, options.now, options.quietMinutes);
}

export function unnotifiedMessages(messages: AdminSummaryMessage[], conversationId: string): AdminSummaryMessage[] {
  return messages.filter((m) => m.conversation_id === conversationId && m.admin_notified !== true);
}

export function buildAdminSummaryEmail(input: {
  influencerName: string;
  brandName: string;
  count: number;
  previews: string[];
  link: string;
  ended: boolean;
}): { subject: string; html: string } {
  const influencer = input.influencerName.trim() || "Influencer";
  const brand = input.brandName.trim() || "Επιχείρηση";
  const countLabel = input.count === 1 ? "1 νέο μήνυμα" : `${input.count} νέα μηνύματα`;
  const subject = `Σύνοψη συνομιλίας: ${influencer} ↔ ${brand} (${input.count === 1 ? "1 μήνυμα" : `${input.count} μηνύματα`})`;
  const why = input.ended
    ? "Η συνομιλία έκλεισε, οπότε σας στέλνουμε μία σύνοψη των νέων μηνυμάτων."
    : "Η συνομιλία έμεινε ήσυχη, οπότε σας στέλνουμε μία σύνοψη των νέων μηνυμάτων.";
  const items = input.previews
    .map(
      (line) =>
        `<li style="margin: 0 0 8px 0; font-size: 13px; color: #1f2937;">${escapeHtml(line)}</li>`
    )
    .join("");
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #0369a1; font-size: 22px; font-weight: 700; margin: 0;">Σύνοψη συνομιλίας στο Influo</h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="margin: 0 0 12px 0;">Γεια σας,</p>
        <p style="margin: 0 0 8px 0;"><strong>${escapeHtml(influencer)}</strong> ↔ <strong>${escapeHtml(brand)}</strong></p>
        <p style="margin: 0 0 16px 0;">${escapeHtml(countLabel)} και από τις δύο πλευρές. ${escapeHtml(why)}</p>
        ${
          items
            ? `<p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #0369a1;">Σύντομη προεπισκόπηση</p><ul style="margin: 0 0 20px 18px; padding: 0;">${items}</ul>`
            : ""
        }
        <div style="margin: 24px 0; text-align: center;">
          <a href="${escapeHtml(input.link)}" style="display: inline-block; padding: 12px 32px; background: #0284c7; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Άνοιγμα στο admin</a>
        </div>
        <p style="margin: 0; font-size: 12px; color: #6b7280;">Δεν θα ξαναστείλουμε email για τα ίδια μηνύματα. Το αν τα διάβασαν οι συμμετέχοντες δεν αλλάζει αυτή τη σύνοψη.</p>
      </div>
    </div>
  `;
  return { subject, html };
}

function latestPreviews(messages: AdminSummaryMessage[], influencerName: string, brandName: string, n = 3): string[] {
  return [...messages]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(-n)
    .map((m) => {
      const who = m.sender_type === "influencer" ? influencerName : brandName;
      return `${who}: ${clipPreview(m.content)}`;
    });
}

function dedupe(messages: AdminSummaryMessage[]): AdminSummaryMessage[] {
  const seen = new Set<string>();
  const out: AdminSummaryMessage[] = [];
  for (const message of messages) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    out.push(message);
  }
  return out;
}

export async function deliverAdminSummaries(args: {
  store: AdminSummaryStore;
  send: (mail: AdminSummaryMail) => Promise<void>;
  adminEmail: string;
  now?: Date;
  quietMinutes?: number;
  forceConversationId?: string;
  includeClosed?: boolean;
  siteUrl: string;
  maxConversations?: number;
  pendingLimit?: number;
}): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const now = args.now ?? new Date();
  const quietMinutes = args.quietMinutes ?? 20;
  const maxConversations = args.maxConversations ?? 25;
  const includeClosed = args.includeClosed === true;
  const to = adminInboxAddress(args.adminEmail);
  const pending = args.forceConversationId ? [] : await args.store.listUnnotified(args.pendingLimit ?? 300);
  const forced = args.forceConversationId
    ? await args.store.listUnnotifiedForConversation(args.forceConversationId)
    : [];
  const messages = dedupe([...forced, ...pending]);
  const ids = [...new Set(messages.map((m) => m.conversation_id))];
  if (args.forceConversationId && !ids.includes(args.forceConversationId)) {
    ids.push(args.forceConversationId);
  }
  const conversations = await args.store.listConversations(ids);
  const ordered = [...conversations].sort((a, b) => {
    if (args.forceConversationId && a.id === args.forceConversationId) return -1;
    if (args.forceConversationId && b.id === args.forceConversationId) return 1;
    const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return at - bt;
  });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  let used = 0;

  for (const conversation of ordered) {
    if (used >= maxConversations) break;
    const force = args.forceConversationId === conversation.id;
    if (!adminSummaryReady(conversation, { now, quietMinutes, force, includeClosed })) {
      skipped += 1;
      continue;
    }
    const batch = unnotifiedMessages(messages, conversation.id);
    if (!batch.length) {
      skipped += 1;
      continue;
    }
    used += 1;
    const claimed = await args.store.claim(batch.map((m) => m.id));
    if (!claimed.length) {
      skipped += 1;
      continue;
    }
    const claimedSet = new Set(claimed);
    const claimedMessages = batch.filter((m) => claimedSet.has(m.id));
    const influencerName = partyLabel(conversation.influencer_name, "Influencer");
    const brandName = partyLabel(conversation.brand_name, partyLabel(conversation.brand_email, "Επιχείρηση"));
    const link = adminConversationLink(args.siteUrl, conversation.id);
    const { subject, html } = buildAdminSummaryEmail({
      influencerName,
      brandName,
      count: claimedMessages.length,
      previews: latestPreviews(claimedMessages, influencerName, brandName),
      link,
      ended: Boolean(conversation.closed_at),
    });
    try {
      await args.send({
        to,
        subject,
        html,
        conversationId: conversation.id,
        messageIds: claimed,
      });
      sent += 1;
    } catch (error) {
      await args.store.release(claimed);
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return { sent, skipped, errors };
}
