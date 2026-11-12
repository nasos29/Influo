/**
 * Central mail identity for Resend.
 * Transactional automation stays on noreply@; conversational replies go to Zoho via support@.
 */

export const MAIL_NOREPLY = "noreply@influo.gr";

/** Zoho / human support inbox (also used as Reply-To). */
export function mailSupportAddress(): string {
  const fromEnv = (process.env.SUPPORT_EMAIL || process.env.ZOHO_SUPPORT_EMAIL || "").trim();
  return fromEnv || "support@influo.gr";
}

export function mailFromNoreply(displayName = "Influo"): string {
  return `${displayName} <${MAIL_NOREPLY}>`;
}

export function mailFromSupport(displayName = "Influo Support"): string {
  return `${displayName} <${mailSupportAddress()}>`;
}

/** Use on emails where the recipient may hit Reply and should reach humans in Zoho. */
export function mailReplyToSupport(): string {
  return mailSupportAddress();
}
