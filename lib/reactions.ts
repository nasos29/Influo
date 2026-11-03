export type ReactionRow = { message_id?: string; reactor: string; emoji: string };
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

/** Groups reaction rows into [{emoji, count, mine}] in first-seen order. */
export function groupReactions(rows: ReactionRow[], me: string) {
  const map = new Map<string, { emoji: string; count: number; mine: boolean }>();
  for (const r of rows) {
    const g = map.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false };
    g.count += 1;
    if (r.reactor === me) g.mine = true;
    map.set(r.emoji, g);
  }
  return [...map.values()];
}

export function byMessage(rows: Required<ReactionRow>[]): Record<string, ReactionRow[]> {
  const out: Record<string, ReactionRow[]> = {};
  for (const r of rows) (out[r.message_id] ||= []).push({ reactor: r.reactor, emoji: r.emoji });
  return out;
}

/** Short one-line quote for reply previews. */
export function quoteText(content: string | null | undefined, hasAttachment = false, max = 90): string {
  const t = (content || "").replace(/\s+/g, " ").trim();
  if (!t) return hasAttachment ? "📎 Συνημμένο" : "…";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
