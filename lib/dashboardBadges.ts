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

export function brandApplicationSeenKey(userId: string): string {
  return `influo.seen.${userId}.brand-applications`;
}

export function brandProposalSeenKey(userId: string): string {
  return `influo.seen.${userId}.brand-proposals`;
}

export function influencerCampaignSeenKey(userId: string): string {
  return `influo.seen.${userId}.influencer-campaigns`;
}

export function influencerProposalSeenKey(userId: string): string {
  return `influo.seen.${userId}.influencer-proposals`;
}

export function readIdList(store: SeenStore, key: string): string[] {
  try {
    const parsed = JSON.parse(store.getItem(key) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.map(String).filter((id) => id.length > 0) : [];
  } catch {
    return [];
  }
}

export function writeIdList(store: SeenStore, key: string, ids: Array<string | number>): void {
  store.setItem(key, JSON.stringify([...new Set(ids.map(String))]));
}

export function readStamp(store: SeenStore, key: string): string | null {
  const value = store.getItem(key);
  return value?.trim() ? value : null;
}

export function writeStamp(store: SeenStore, key: string, iso: string): void {
  store.setItem(key, iso);
}

export function countUnseenIds(ids: Array<string | number>, seenIds: Array<string | number>): number {
  const seen = new Set(seenIds.map(String));
  return ids.map(String).filter((id) => id && !seen.has(id)).length;
}

export function countNewerThan(times: Array<string | null | undefined>, seenAt: string | null): number {
  const present = times.filter((time): time is string => !!time);
  if (!seenAt) return present.length;
  return present.filter((time) => time > seenAt).length;
}

/** Red tab badge. Opening the tab clears it; before the list has loaded, do not count (an empty list must not look like "all seen"). */
export function badgeAfterOpen(
  tabOpen: boolean,
  loaded: boolean,
  ids: Array<string | number>,
  seenIds: Array<string | number>
): number {
  if (tabOpen || !loaded) return 0;
  return countUnseenIds(ids, seenIds);
}

export type ProposalAlertRow = {
  id: string | number;
  status?: string | null;
  counter_proposal_status?: string | null;
  counter_proposal_budget?: number | string | null;
  brand_agreement_accepted?: boolean | null;
};

/** Brand proposals-tab alert: counter-offers waiting on the brand, plus accepted deals not signed by the brand. */
export function brandProposalAlertIds(rows: ProposalAlertRow[]): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    if (row.counter_proposal_status === "pending" && row.counter_proposal_budget) {
      ids.push(`counter:${row.id}`);
    }
    const open = row.status === "accepted" || row.status === "completed";
    if (open && !row.brand_agreement_accepted) ids.push(`agree:${row.id}`);
  }
  return ids;
}

/** Influencer proposals-tab alert: offers the influencer has not answered yet. */
export function influencerProposalAlertIds(rows: Array<{ id: string | number; status?: string | null }>): string[] {
  return rows.filter((row) => row.status === "pending").map((row) => String(row.id));
}

export function latestIso(times: Array<string | null | undefined>, fallback: string): string {
  let latest = fallback;
  for (const time of times) {
    if (time && time > latest) latest = time;
  }
  return latest;
}
