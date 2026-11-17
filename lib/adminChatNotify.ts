import { supabaseService } from "@/lib/apiAuth";
import { ADMIN_CHAT_DISPLAY_NAME } from "@/lib/adminChat";
import { pushParty } from "@/lib/proposalNotify";
import { sendPushToBrand } from "@/lib/push";

function normEmail(value: string | null | undefined): string {
  return (value || "").toLowerCase().trim();
}

export async function notifyUserOfAdminMessage(args: {
  conversationId: string;
  preview: string;
  influencerId: string | null;
  brandEmail: string | null;
}) {
  const text = args.preview.slice(0, 60) + (args.preview.length > 60 ? "…" : "");
  const id = encodeURIComponent(args.conversationId);
  if (args.influencerId) {
    await pushParty({
      type: "message",
      side: "influencer",
      influencerId: args.influencerId,
      brandEmail: null,
      conversationId: args.conversationId,
      payload: {
        title: "💬 Νέο μήνυμα",
        body: `${ADMIN_CHAT_DISPLAY_NAME}: ${text}`,
        url: `/dashboard?tab=messages&conversation=${id}`,
        tag: `message-admin-${args.conversationId}`,
      },
    });
    return;
  }
  if (args.brandEmail) {
    await pushParty({
      type: "message",
      side: "brand",
      influencerId: "",
      brandEmail: args.brandEmail,
      conversationId: args.conversationId,
      payload: {
        title: "💬 Νέο μήνυμα",
        body: `${ADMIN_CHAT_DISPLAY_NAME}: ${text}`,
        url: `/brand/dashboard?tab=messages&conversation=${id}`,
        tag: `message-admin-${args.conversationId}`,
      },
    });
  }
}

export async function notifyAdminOfUserReply(args: {
  conversationId: string;
  preview: string;
  fromName: string;
}) {
  const adminEmail = normEmail(process.env.ADMIN_EMAIL);
  if (!adminEmail.includes("@")) return;
  const text = args.preview.slice(0, 60) + (args.preview.length > 60 ? "…" : "");
  const id = encodeURIComponent(args.conversationId);
  const { data } = await supabaseService()
    .from("conversations")
    .select("last_activity_admin")
    .eq("id", args.conversationId)
    .maybeSingle();
  const stamp = typeof data?.last_activity_admin === "string" ? data.last_activity_admin : null;
  if (stamp) {
    const age = Date.now() - new Date(stamp).getTime();
    if (!Number.isNaN(age) && age < 45_000) return;
  }
  try {
    await sendPushToBrand(adminEmail, {
      title: "💬 Νέο μήνυμα",
      body: `${args.fromName}: ${text}`,
      url: `/admin?tab=admin_chat&conversation=${id}`,
      tag: `message-admin-inbox-${args.conversationId}`,
    });
  } catch {
    /* push must not block */
  }
}
