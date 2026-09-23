/** Relative timestamps and day labels for chat UI. */

export function formatChatRelativeTime(
  iso: string | null | undefined,
  lang: 'el' | 'en' = 'el'
): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return lang === 'el' ? 'τώρα' : 'now';
  if (diffMin < 60) return lang === 'el' ? `${diffMin}λ` : `${diffMin}m`;
  if (diffHr < 24) return lang === 'el' ? `${diffHr}ω` : `${diffHr}h`;
  if (diffDay === 1) return lang === 'el' ? 'χθες' : 'yesterday';
  if (diffDay < 7) return lang === 'el' ? `${diffDay}η` : `${diffDay}d`;

  return date.toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

export function formatChatDayLabel(
  iso: string,
  lang: 'el' | 'en' = 'el'
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfMsg = new Date(date);
  startOfMsg.setHours(0, 0, 0, 0);
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfMsg.getTime()) / 86400000
  );

  if (dayDiff === 0) return lang === 'el' ? 'Σήμερα' : 'Today';
  if (dayDiff === 1) return lang === 'el' ? 'Χθες' : 'Yesterday';

  return date.toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: dayDiff > 300 ? 'numeric' : undefined,
  });
}

export function sameChatDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function clipChatPreview(text: string, max = 56): string {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function chatInitial(name: string): string {
  const n = (name || '').trim();
  if (!n) return '?';
  return n.charAt(0).toUpperCase();
}
