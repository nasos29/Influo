/** Admin ↔ user 1:1 chat (separate from brand↔influencer peer threads). */

export const ADMIN_CHAT_DISPLAY_NAME = "Θανάσης - Influo.gr";
export const ADMIN_CHAT_AVATAR_SRC = "/logo-icon.svg";
export const ADMIN_CHAT_KIND = "admin" as const;
export const PEER_CHAT_KIND = "peer" as const;

export type ConversationKind = typeof ADMIN_CHAT_KIND | typeof PEER_CHAT_KIND;
export type AdminChatUserType = "influencer" | "brand";

export function isAdminConversationKind(kind: string | null | undefined): boolean {
  return kind === ADMIN_CHAT_KIND;
}

export function adminChatCounterpartyName(
  kind: string | null | undefined,
  mode: "influencer" | "brand",
  peerName: string | null | undefined,
  fallback: string
): string {
  if (isAdminConversationKind(kind)) return ADMIN_CHAT_DISPLAY_NAME;
  const clean = (peerName || "").trim();
  return clean || fallback;
}
