export function emailsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = (left || "").trim().toLowerCase();
  const b = (right || "").trim().toLowerCase();
  return a.length > 0 && a === b;
}

export type TicketIdentity = {
  user_id?: string | null;
  user_type?: string | null;
  user_email?: string | null;
};

/**
 * Influencer tickets belong to the session whose email is that influencer's contact_email.
 * Brand tickets belong to the session whose email is the ticket user_email.
 */
export function userOwnsTicket(
  ticket: TicketIdentity,
  sessionEmail: string | null | undefined,
  influencerContactEmail: string | null | undefined
): boolean {
  const kind = (ticket.user_type || "").toLowerCase();
  if (kind === "brand") return emailsMatch(ticket.user_email, sessionEmail);
  if (kind === "influencer") return emailsMatch(influencerContactEmail, sessionEmail);
  return false;
}

export function ticketReadStatus(input: { signedIn: boolean; isAdmin: boolean; owns: boolean }): 200 | 401 | 403 {
  if (!input.signedIn) return 401;
  if (input.isAdmin || input.owns) return 200;
  return 403;
}

export function ticketStatusChange(input: {
  signedIn: boolean;
  isAdmin: boolean;
  owns: boolean;
  action: "close" | "reopen";
}): 200 | 401 | 403 {
  if (!input.signedIn) return 401;
  if (input.isAdmin) return 200;
  if (input.owns && input.action === "close") return 200;
  return 403;
}

export const ticketAuthCopy = {
  401: { el: "Χρειάζεται σύνδεση.", en: "Sign in required." },
  403: { el: "Δεν έχετε πρόσβαση σε αυτό το ticket.", en: "You do not have access to this ticket." },
} as const;
