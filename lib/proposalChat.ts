import { supabaseService } from "@/lib/apiAuth";
import { influencerContact } from "@/lib/proposalAccess";

type ThreadArgs = {
  influencerId: string;
  brandEmail: string;
  brandName: string;
  proposalId: string | number;
  content: string;
  /** New offer from a signed-in brand: always attach this proposal and add the message. */
  replaceLink: boolean;
  /** Guest offer opened from the influencer dashboard: do not email it again. */
  alreadyNotified: boolean;
};

async function insertMessage(row: Record<string, unknown>): Promise<void> {
  const admin = supabaseService();
  const payload: Record<string, unknown> = { ...row };
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await admin.from("messages").insert([payload]);
    if (!result.error) return;
    const message = result.error.message || "";
    if (/attachments/i.test(message) && "attachments" in payload) {
      delete payload.attachments;
      continue;
    }
    if (/email_sent/i.test(message) && "email_sent" in payload) {
      delete payload.email_sent;
      continue;
    }
    if (/admin_notified/i.test(message) && "admin_notified" in payload) {
      delete payload.admin_notified;
      continue;
    }
    if (/sent_via_email/i.test(message) && "sent_via_email" in payload) {
      delete payload.sent_via_email;
      continue;
    }
    throw new Error(message || "Could not save the proposal message");
  }
}

/**
 * Puts the offer on the brand↔influencer thread so the chat card can load it.
 * A signed-in send stays eligible for the normal unread summary.
 * A guest send is already covered by the proposal email, so it is not summarized again.
 */
export async function ensureProposalThread(args: ThreadArgs): Promise<string | null> {
  const admin = supabaseService();
  const brandEmail = args.brandEmail.toLowerCase().trim();
  if (!brandEmail.includes("@")) return null;

  const { data: existingRows } = await admin
    .from("conversations")
    .select("id, proposal_id, closed_at")
    .eq("influencer_id", args.influencerId)
    .ilike("brand_email", brandEmail)
    .limit(1);
  const existing = existingRows?.[0];
  let conversationId = existing?.id as string | undefined;
  const created = !conversationId;

  if (!conversationId) {
    const contact = await influencerContact(args.influencerId);
    const profile = await admin.from("influencers").select("id, display_name").eq("id", args.influencerId).maybeSingle();
    if (!profile.data) return null;
    const { data: createdRow, error } = await admin
      .from("conversations")
      .insert([
        {
          influencer_id: args.influencerId,
          influencer_name: profile.data.display_name,
          influencer_email: contact.email || "",
          brand_email: brandEmail,
          brand_name: args.brandName,
          proposal_id: args.proposalId,
        },
      ])
      .select("id")
      .single();
    if (error || !createdRow) return null;
    conversationId = createdRow.id as string;
  } else if (existing?.closed_at) {
    await admin.from("conversations").update({ closed_at: null }).eq("id", conversationId);
  }

  if (args.replaceLink || !existing?.proposal_id) {
    await admin.from("conversations").update({ proposal_id: args.proposalId }).eq("id", conversationId);
  }

  const writeMessage = created || args.replaceLink;
  if (writeMessage) {
    const now = new Date().toISOString();
    await insertMessage({
      conversation_id: conversationId,
      sender_id: brandEmail,
      sender_type: "brand",
      content: args.content.slice(0, 5000),
      read: false,
      sent_via_email: false,
      email_sent: args.alreadyNotified,
      admin_notified: args.alreadyNotified,
    });
    await admin
      .from("conversations")
      .update({ last_message_at: now, last_activity_brand: now, closed_at: null })
      .eq("id", conversationId);
  }

  return conversationId;
}
