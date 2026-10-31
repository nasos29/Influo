/** Shared paging helpers for admin list routes. No schema changes. */

export function escapeIlike(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/,/g, " ");
}

export function parsePositiveInt(raw: string | null, fallback: number): number {
  const n = parseInt(raw || "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function pageBounds(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function ilikePattern(raw: string): string {
  return `%${escapeIlike(raw.trim())}%`;
}

export function sevenDaysAgoIso(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}
