import { after } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { activityInThread, logPush } from "@/lib/deliveryLog";
import { sendPushToBrand, sendPushToInfluencer, type PushPayload } from "@/lib/push";

/** Keep mail and push alive after the HTTP response, without blocking the button. */
export function deferAfterResponse(work: () => Promise<void>): void {
  after(() =>
    work().catch(() => {
      console.error("[after response] failed");
    })
  );
}

export async function conversationIdForParties(
  influencerId: string,
  brandEmail: string | null | undefined
): Promise<string | null> {
  const email = (brandEmail || "").trim();
  if (!influencerId || !email.includes("@")) return null;
  const { data } = await supabaseService()
    .from("conversations")
    .select("id")
    .eq("influencer_id", influencerId)
    .ilike("brand_email", email)
    .limit(1);
  const id = data?.[0]?.id;
  return typeof id === "string" ? id : null;
}

export async function recipientViewingThread(
  conversationId: string | null | undefined,
  side: "influencer" | "brand"
): Promise<boolean> {
  if (!conversationId) return false;
  const column = side === "influencer" ? "last_activity_influencer" : "last_activity_brand";
  const { data } = await supabaseService().from("conversations").select(column).eq("id", conversationId).maybeSingle();
  const stamp = data && typeof data === "object" ? (data as Record<string, unknown>)[column] : null;
  return activityInThread(typeof stamp === "string" ? stamp : null);
}

/** Push every subscription for the recipient. Skip when they are already in the thread. */
export async function pushParty(args: {
  type: string;
  side: "influencer" | "brand";
  influencerId: string;
  brandEmail: string | null | undefined;
  conversationId?: string | null;
  payload: PushPayload;
}): Promise<void> {
  const conversationId =
    args.conversationId === undefined
      ? await conversationIdForParties(args.influencerId, args.brandEmail)
      : args.conversationId;
  if (await recipientViewingThread(conversationId, args.side)) {
    logPush(args.type, 0, true);
    return;
  }
  try {
    const result =
      args.side === "influencer"
        ? await sendPushToInfluencer(args.influencerId, args.payload)
        : await sendPushToBrand(args.brandEmail || "", args.payload);
    logPush(args.type, result.sent);
  } catch {
    logPush(args.type, 0);
  }
}
