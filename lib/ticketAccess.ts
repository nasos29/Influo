import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { isAdminUser, supabaseService, userFromBearer } from "@/lib/apiAuth";
import { loadChatActor } from "@/lib/chatActor";
import {
  emailsMatch,
  ticketAuthCopy,
  userOwnsTicket,
  type TicketIdentity,
} from "@/lib/ticketAccessRules";

export { emailsMatch, ticketReadStatus, ticketStatusChange, userOwnsTicket } from "@/lib/ticketAccessRules";
export type { TicketIdentity } from "@/lib/ticketAccessRules";

export function ticketAuthResponse(request: Request, status: 401 | 403): NextResponse {
  const english = (request.headers.get("accept-language") || "").toLowerCase().startsWith("en");
  return NextResponse.json(
    { success: false, error: english ? ticketAuthCopy[status].en : ticketAuthCopy[status].el },
    { status }
  );
}

export async function influencerContactEmail(influencerId: string): Promise<string | null> {
  const admin = supabaseService();
  const priv = await admin.from("influencer_private").select("contact_email").eq("influencer_id", influencerId).maybeSingle();
  const fromPrivate = !priv.error && typeof priv.data?.contact_email === "string" ? priv.data.contact_email.trim() : "";
  if (fromPrivate) return fromPrivate;
  const legacy = await admin.from("influencers").select("contact_email").eq("id", influencerId).maybeSingle();
  const email = typeof legacy.data?.contact_email === "string" ? legacy.data.contact_email.trim() : "";
  return email || null;
}

async function brandContactEmail(brandId: string): Promise<string | null> {
  const admin = supabaseService();
  const priv = await admin.from("brand_private").select("contact_email").eq("brand_id", brandId).maybeSingle();
  const fromPrivate = !priv.error && typeof priv.data?.contact_email === "string" ? priv.data.contact_email.trim() : "";
  if (fromPrivate) return fromPrivate;
  const legacy = await admin.from("brands").select("contact_email").eq("id", brandId).maybeSingle();
  const email = typeof legacy.data?.contact_email === "string" ? legacy.data.contact_email.trim() : "";
  return email || null;
}

export async function sessionOwnsTicket(user: User, ticket: TicketIdentity): Promise<boolean> {
  const kind = (ticket.user_type || "").toLowerCase();
  if (kind === "influencer" && ticket.user_id) {
    return userOwnsTicket(ticket, user.email, await influencerContactEmail(String(ticket.user_id)));
  }
  if (kind === "brand") {
    if (userOwnsTicket(ticket, user.email, null)) return true;
    const actor = await loadChatActor(user);
    if (ticket.user_id && actor.brandId && String(ticket.user_id) === actor.brandId) return true;
    return emailsMatch(ticket.user_email, actor.brandEmail);
  }
  return false;
}

/** Logged-in owner, or admin. 401 when signed out, 403 otherwise. */
export async function requireTicketReader(request: Request, ticket: TicketIdentity): Promise<NextResponse | null> {
  const user = await userFromBearer(request);
  if (!user) return ticketAuthResponse(request, 401);
  if (await isAdminUser(user)) return null;
  if (await sessionOwnsTicket(user, ticket)) return null;
  return ticketAuthResponse(request, 403);
}

export async function requireTicketOwner(request: Request, ticket: TicketIdentity): Promise<NextResponse | null> {
  const user = await userFromBearer(request);
  if (!user) return ticketAuthResponse(request, 401);
  if (await sessionOwnsTicket(user, ticket)) return null;
  return ticketAuthResponse(request, 403);
}

export async function requireTicketStatusActor(
  request: Request,
  ticket: TicketIdentity,
  action: "close" | "reopen"
): Promise<NextResponse | null> {
  const user = await userFromBearer(request);
  if (!user) return ticketAuthResponse(request, 401);
  if (await isAdminUser(user)) return null;
  if (action === "close" && (await sessionOwnsTicket(user, ticket))) return null;
  return ticketAuthResponse(request, 403);
}

/** New-ticket upload: the user_id must be this session's influencer or brand. */
export async function sessionMayUploadAs(user: User, userId: string): Promise<boolean> {
  if (emailsMatch(userId, user.email)) return true;
  if (emailsMatch(await influencerContactEmail(userId), user.email)) return true;
  const actor = await loadChatActor(user);
  if (actor.influencerId && userId === actor.influencerId) return true;
  if (actor.brandId && userId === actor.brandId) return true;
  return emailsMatch(await brandContactEmail(userId), user.email);
}
