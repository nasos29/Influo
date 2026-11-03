import { NextResponse } from "next/server";
import { supabaseService, userFromBearer } from "@/lib/apiAuth";
import { loadChatActor } from "@/lib/chatActor";

export type Side = "influencer" | "brand";

/** Resolves the caller's side in the conversation that owns messageId, or an error response. */
export async function sideForMessage(req: Request, messageId: string, as: unknown): Promise<{ side: Side; conversationId: string } | NextResponse> {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const admin = supabaseService();
  const { data: msg } = await admin.from("messages").select("id, conversation_id").eq("id", messageId).maybeSingle();
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: conv } = await admin.from("conversations").select("influencer_id, brand_email").eq("id", msg.conversation_id).maybeSingle();
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const actor = await loadChatActor(user);
  const isInf = !!actor.influencerId && actor.influencerId === conv.influencer_id;
  const isBrand = !!actor.brandEmail && actor.brandEmail === String(conv.brand_email || "").toLowerCase().trim();
  let side: Side | null = null;
  if (as === "influencer" && isInf) side = "influencer";
  else if (as === "brand" && isBrand) side = "brand";
  else if (as == null) side = isInf ? "influencer" : isBrand ? "brand" : null;
  if (!side) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return { side, conversationId: msg.conversation_id };
}
