/** Per-admin "I opened this tab" marks. Stored in the browser under the admin's user id so a reload keeps them. */

export type SeenStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function conversationSeenKey(userId: string): string {
  return `influo.seen.${userId}.conversations`;
}

export function companySeenKey(userId: string): string {
  return `influo.seen.${userId}.companies`;
}

export function readIdList(store: SeenStore, key: string): string[] {
  try {
    const parsed = JSON.parse(store.getItem(key) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.map((id) => String(id)).filter((id) => id.length > 0) : [];
  } catch {
    return [];
  }
}

export function writeIdList(store: SeenStore, key: string, ids: Array<string | number>): void {
  store.setItem(key, JSON.stringify([...new Set(ids.map((id) => String(id)))]));
}

export function readStamp(store: SeenStore, key: string): string | null {
  const value = store.getItem(key);
  return value && value.trim() ? value : null;
}

export function writeStamp(store: SeenStore, key: string, iso: string): void {
  store.setItem(key, iso);
}

export function countUnseenIds(ids: Array<string | number>, seenIds: Array<string | number>): number {
  const seen = new Set(seenIds.map((id) => String(id)));
  return ids.map((id) => String(id)).filter((id) => id && !seen.has(id)).length;
}

export function countNewerThan(times: Array<string | null | undefined>, seenAt: string | null): number {
  const present = times.filter((time): time is string => !!time);
  if (!seenAt) return present.length;
  return present.filter((time) => time > seenAt).length;
}

export function latestIso(times: Array<string | null | undefined>, fallback: string): string {
  let latest = fallback;
  for (const time of times) {
    if (time && time > latest) latest = time;
  }
  return latest;
}
