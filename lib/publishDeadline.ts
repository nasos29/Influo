/** Optional proposals.publish_deadline. Empty means the date is agreed later. */

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parsePublishDeadline(value: unknown): { ok: true; date: string | null } | { ok: false } {
  if (value == null) return { ok: true, date: null };
  if (typeof value !== "string") return { ok: false };
  const text = value.trim();
  if (!text) return { ok: true, date: null };
  const match = DATE.exec(text);
  if (!match) return { ok: false };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000 || year > 2100) return { ok: false };
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { ok: false };
  }
  return { ok: true, date: `${match[1]}-${match[2]}-${match[3]}` };
}
