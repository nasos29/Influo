import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/apiAuth";
import { sideForMessage } from "@/lib/chatMessageAccess";

export const dynamic = "force-dynamic";

/** Toggle one emoji reaction for the caller's side on a message. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const emoji = typeof body.emoji === "string" ? body.emoji.trim() : "";
  if (!emoji || emoji.length > 16 || /[\w<>]/.test(emoji)) return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  const access = await sideForMessage(req, String(body.messageId || ""), body.as);
  if (access instanceof NextResponse) return access;
  const admin = supabaseService();
  const key = { message_id: body.messageId, reactor: access.side, emoji };
  const { data: existing } = await admin.from("message_reactions").select("emoji").match(key).maybeSingle();
  if (existing) await admin.from("message_reactions").delete().match(key);
  else {
    const { count } = await admin.from("message_reactions").select("emoji", { count: "exact", head: true }).eq("message_id", body.messageId).eq("reactor", access.side);
    if ((count || 0) >= 6) return NextResponse.json({ error: "Too many" }, { status: 400 });
    await admin.from("message_reactions").insert(key);
  }
  const { data } = await admin.from("message_reactions").select("reactor, emoji").eq("message_id", body.messageId);
  return NextResponse.json({ reactions: data || [] });
}
