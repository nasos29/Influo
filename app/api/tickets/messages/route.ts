import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadTicketMessages } from "@/lib/supportThreadStore";
import { requireTicketReader } from "@/lib/ticketAccess";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const ticketId = new URL(req.url).searchParams.get("ticket_id");
    if (!ticketId) {
      return NextResponse.json({ success: false, error: "Missing ticket_id" }, { status: 400 });
    }
    const { data: ticket, error } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .single();
    if (error || !ticket) {
      return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });
    }
    const denied = await requireTicketReader(req, ticket);
    if (denied) return denied;
    const thread = await loadTicketMessages(supabaseAdmin, ticket);
    return NextResponse.json({ success: true, messages: thread.messages, threaded: thread.threaded });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load messages";
    console.error("[Ticket messages]", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
