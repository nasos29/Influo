/** Online if the heartbeat is fresh. A stuck is_online flag does not keep someone online. */

/** Online window must outlast the 2-minute heartbeat. */
export const PRESENCE_STALE_MS = 240_000;
/** At most one presence upsert every 2 minutes. */
export const PRESENCE_HEARTBEAT_MS = 120_000;

export function presenceOnline(
  row: { is_online?: boolean | null; last_seen?: string | null } | null | undefined,
  now = Date.now(),
  staleMs = PRESENCE_STALE_MS
): boolean {
  if (!row?.last_seen || row.is_online !== true) return false;
  const seen = new Date(row.last_seen).getTime();
  if (Number.isNaN(seen)) return false;
  return now - seen < staleMs;
}

export function formatActiveLabel(
  lastSeen: string | null | undefined,
  online: boolean,
  lang: "el" | "en" = "el",
  now = Date.now()
): string {
  if (online) return lang === "el" ? "Ενεργός τώρα" : "Active now";
  if (!lastSeen) return lang === "el" ? "Εκτός σύνδεσης" : "Offline";
  const seen = new Date(lastSeen).getTime();
  if (Number.isNaN(seen)) return lang === "el" ? "Εκτός σύνδεσης" : "Offline";
  const mins = Math.max(1, Math.floor((now - seen) / 60000));
  if (lang === "en") {
    if (mins < 60) return `Active ${mins} minute${mins === 1 ? "" : "s"} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Active ${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `Active ${days} day${days === 1 ? "" : "s"} ago`;
  }
  if (mins < 60) return `Ενεργός πριν από ${mins} ${mins === 1 ? "λεπτό" : "λεπτά"}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Ενεργός πριν από ${hours} ${hours === 1 ? "ώρα" : "ώρες"}`;
  const days = Math.floor(hours / 24);
  return `Ενεργός πριν από ${days} ${days === 1 ? "ημέρα" : "ημέρες"}`;
}
