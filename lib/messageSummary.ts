/** One summary email per quiet conversation, only for messages still unread in the app. */

export const DEFAULT_QUIET_MINUTES = 20;

export type SummaryMessage = {
  id: string;
  conversation_id: string;
  sender_type: "influencer" | "brand";
  content: string;
  created_at: string;
  read: boolean;
  email_sent: boolean;
};

export type SummaryConversation = {
  id: string;
  influencer_id: string;
  influencer_name: string | null;
  influencer_email: string | null;
  brand_email: string | null;
  brand_name: string | null;
  last_message_at: string | null;
};

export type SummaryStore = {
  listPending(limit: number): Promise<SummaryMessage[]>;
  listPendingForConversation?(conversationId: string): Promise<SummaryMessage[]>;
  listConversations(ids: string[]): Promise<SummaryConversation[]>;
  claim(ids: string[]): Promise<string[]>;
  release(ids: string[]): Promise<void>;
  influencerEmail(influencerId: string, fallback: string | null): Promise<string | null>;
  brandEmail(conversationEmail: string): Promise<string | null>;
};

export type SummaryMail = {
  to: string;
  subject: string;
  html: string;
  conversationId: string;
  recipient: "influencer" | "brand";
  messageIds: string[];
};

export function quietMinutesFromEnv(raw: string | undefined | null): number {
  if (raw == null || raw.trim() === "") return DEFAULT_QUIET_MINUTES;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_QUIET_MINUTES;
  return Math.min(180, Math.max(5, Math.round(n)));
}

export function conversationIsQuiet(
  lastMessageAt: string | null | undefined,
  now: Date,
  quietMinutes: number
): boolean {
  if (!lastMessageAt) return true;
  const t = new Date(lastMessageAt).getTime();
  if (Number.isNaN(t)) return false;
  return now.getTime() - t >= quietMinutes * 60 * 1000;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function clipPreview(text: string, max = 140): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "Συνημμένο αρχείο";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

export function conversationLink(
  siteUrl: string,
  recipient: "influencer" | "brand",
  conversationId: string
): string {
  const base = siteUrl.replace(/\/$/, "");
  const id = encodeURIComponent(conversationId);
  if (recipient === "influencer") return `${base}/dashboard?tab=messages&conversation=${id}`;
  return `${base}/brand/dashboard?tab=messages&conversation=${id}`;
}

export function summarySubject(count: number, counterpartName: string): string {
  const name = counterpartName.trim() || "Influo";
  if (count === 1) return `1 αδιάβαστο μήνυμα από ${name}`;
  return `${count} αδιάβαστα μηνύματα από ${name}`;
}

export function buildSummaryEmail(input: {
  count: number;
  counterpartName: string;
  previews: string[];
  link: string;
}): { subject: string; html: string } {
  const name = input.counterpartName.trim() || "την άλλη πλευρά";
  const subject = summarySubject(input.count, name);
  const items = input.previews
    .map(
      (line) =>
        `<li style="margin: 0 0 8px 0; font-size: 13px; color: #1f2937;">${escapeHtml(line)}</li>`
    )
    .join("");
  const countLine =
    input.count === 1
      ? `Έχετε <strong>1 αδιάβαστο μήνυμα</strong> από <strong>${escapeHtml(name)}</strong>.`
      : `Έχετε <strong>${input.count} αδιάβαστα μηνύματα</strong> από <strong>${escapeHtml(name)}</strong>.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #0369a1; font-size: 22px; font-weight: 700; margin: 0;">Αδιάβαστα μηνύματα στο Influo</h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #f3f4f6; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="margin: 0 0 12px 0;">Γεια σας,</p>
        <p style="margin: 0 0 16px 0;">${countLine} Η συνομιλία έμεινε ήσυχη, οπότε σας στέλνουμε μία σύνοψη.</p>
        ${
          items
            ? `<p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #0369a1;">Τελευταία μηνύματα</p><ul style="margin: 0 0 20px 18px; padding: 0;">${items}</ul>`
            : ""
        }
        <div style="margin: 24px 0; text-align: center;">
          <a href="${escapeHtml(input.link)}" style="display: inline-block; padding: 12px 32px; background: #0284c7; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Άνοιγμα συνομιλίας</a>
        </div>
        <p style="margin: 0; font-size: 12px; color: #6b7280;">Δεν θα ξαναστείλουμε email για τα ίδια μηνύματα. Αν τα έχετε ήδη διαβάσει στην εφαρμογή, δεν χρειάζεται να κάνετε κάτι.</p>
      </div>
    </div>
  `;
  return { subject, html };
}

type PendingDigest = {
  conversation: SummaryConversation;
  recipient: "influencer" | "brand";
  messages: SummaryMessage[];
};

export function digestsForConversation(
  conversation: SummaryConversation,
  messages: SummaryMessage[],
  options: { now: Date; quietMinutes: number; force: boolean }
): PendingDigest[] {
  if (
    !options.force &&
    !conversationIsQuiet(conversation.last_message_at, options.now, options.quietMinutes)
  ) {
    return [];
  }
  const pending = messages.filter(
    (m) =>
      m.conversation_id === conversation.id &&
      m.read === false &&
      m.email_sent === false
  );
  const out: PendingDigest[] = [];
  const forInfluencer = pending.filter((m) => m.sender_type === "brand");
  const forBrand = pending.filter((m) => m.sender_type === "influencer");
  if (forInfluencer.length) {
    out.push({ conversation, recipient: "influencer", messages: forInfluencer });
  }
  if (forBrand.length) {
    out.push({ conversation, recipient: "brand", messages: forBrand });
  }
  return out;
}

function latestPreviews(messages: SummaryMessage[], n = 3): string[] {
  return [...messages]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(-n)
    .map((m) => clipPreview(m.content));
}

export async function deliverSummaries(args: {
  store: SummaryStore;
  send: (mail: SummaryMail) => Promise<void>;
  now?: Date;
  quietMinutes?: number;
  forceConversationId?: string;
  siteUrl: string;
  maxConversations?: number;
  pendingLimit?: number;
}): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const now = args.now ?? new Date();
  const quietMinutes = args.quietMinutes ?? DEFAULT_QUIET_MINUTES;
  const maxConversations = args.maxConversations ?? 25;
  // An explicit close only summarizes that thread. The cron drains the rest.
  const pending = args.forceConversationId
    ? []
    : await args.store.listPending(args.pendingLimit ?? 300);
  const forced = args.forceConversationId
    ? await args.store.listPendingForConversation?.(args.forceConversationId)
    : [];
  const messages = dedupeMessages([...(forced || []), ...pending]);

  const ids = [...new Set(messages.map((m) => m.conversation_id))];
  if (args.forceConversationId && !ids.includes(args.forceConversationId)) {
    ids.push(args.forceConversationId);
  }
  const conversations = await args.store.listConversations(ids);
  const byId = new Map(conversations.map((c) => [c.id, c]));

  const ordered = [...byId.values()].sort((a, b) => {
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
    const digests = digestsForConversation(conversation, messages, { now, quietMinutes, force });
    if (!digests.length) {
      skipped += 1;
      continue;
    }
    used += 1;
    for (const digest of digests) {
      const to =
        digest.recipient === "influencer"
          ? await args.store.influencerEmail(conversation.influencer_id, conversation.influencer_email)
          : conversation.brand_email
            ? await args.store.brandEmail(conversation.brand_email)
            : null;
      if (!to) {
        errors.push(`missing email for ${digest.recipient} on ${conversation.id}`);
        skipped += 1;
        continue;
      }
      const idsToClaim = digest.messages.map((m) => m.id);
      const claimed = await args.store.claim(idsToClaim);
      if (!claimed.length) {
        skipped += 1;
        continue;
      }
      const claimedSet = new Set(claimed);
      const claimedMessages = digest.messages.filter((m) => claimedSet.has(m.id));
      const counterpart =
        digest.recipient === "influencer"
          ? conversation.brand_name || "Επιχείρηση"
          : conversation.influencer_name || "Influencer";
      const link = conversationLink(args.siteUrl, digest.recipient, conversation.id);
      const { subject, html } = buildSummaryEmail({
        count: claimedMessages.length,
        counterpartName: counterpart,
        previews: latestPreviews(claimedMessages),
        link,
      });
      try {
        await args.send({
          to,
          subject,
          html,
          conversationId: conversation.id,
          recipient: digest.recipient,
          messageIds: claimed,
        });
        sent += 1;
      } catch (error) {
        await args.store.release(claimed);
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  return { sent, skipped, errors };
}

function dedupeMessages(messages: SummaryMessage[]): SummaryMessage[] {
  const seen = new Set<string>();
  const out: SummaryMessage[] = [];
  for (const message of messages) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    out.push(message);
  }
  return out;
}
