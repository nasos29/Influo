export type ReadViewer = "influencer" | "brand";

export type ReadableMessage = {
  id: string;
  sender_type: string;
  read?: boolean | null;
};

/** The role whose messages this viewer is allowed to mark read. */
export function otherPartySender(viewer: ReadViewer): "influencer" | "brand" {
  return viewer === "influencer" ? "brand" : "influencer";
}

/**
 * Ids the recipient may mark read: the other party's messages that are not already read.
 * Own messages are never included. Null read counts as unread.
 */
export function unreadFromOtherParty(messages: ReadableMessage[], viewer: ReadViewer): string[] {
  const other = otherPartySender(viewer);
  return messages.filter((m) => m.sender_type === other && m.read !== true).map((m) => m.id);
}
