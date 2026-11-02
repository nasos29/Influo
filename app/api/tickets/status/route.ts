import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { reopenStatus } from "@/lib/supportThread";
import { loadTicketMessages } from "@/lib/supportThreadStore";
import { requireTicketStatusActor } from "@/lib/ticketAccess";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ticketId = body.ticket_id as string | undefined;
    const action = body.action as string | undefined;
    if (!ticketId || (action !== "close" && action !== "reopen")) {
      return NextResponse.json({ success: false, error: "Missing ticket_id or action" }, { status: 400 });
    }

    const { data: ticket, error } = await supabaseAdmin
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .single();
    if (error || !ticket) {
      return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });
    }
    const denied = await requireTicketStatusActor(req, ticket, action);
    if (denied) return denied;

    let status = "closed";
    if (action === "reopen") {
      const thread = await loadTicketMessages(supabaseAdmin, ticket);
      status = thread.threaded
        ? reopenStatus(thread.messages, Boolean(ticket.admin_reply))
        : "open";
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("support_tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", ticketId)
      .select()
      .single();
    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }
    const thread = await loadTicketMessages(supabaseAdmin, updated);
    return NextResponse.json({ success: true, ticket: updated, messages: thread.messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update ticket";
    console.error("[Ticket status]", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
