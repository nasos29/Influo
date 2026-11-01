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

export type ReadMark = {
  /** When the viewer opened the thread and asked to mark it read. */
  startedAt: number;
  /** When the server confirmed the write. Null while that request is in flight. */
  confirmedAt: number | null;
};

/**
 * A list reload that started before the open was confirmed must not paint the old badge back.
 * Once the write is confirmed, a later reload is trusted, including a new unread that arrived after.
 */
export function unreadAfterRefresh(
  serverCount: number,
  mark: ReadMark | undefined,
  fetchStartedAt: number,
): number {
  if (!mark) return serverCount;
  if (mark.confirmedAt == null || mark.confirmedAt >= fetchStartedAt) return 0;
  return serverCount;
}
