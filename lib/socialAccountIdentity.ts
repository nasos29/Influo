/**
 * Normalize Instagram/TikTok identities for duplicate detection.
 * No DB schema — compares lowercase usernames without leading @ inside accounts jsonb.
 */

export function normalizeSocialUsername(raw: unknown): string {
  if (raw == null) return "";
  return String(raw)
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

export function normalizeSocialPlatform(raw: unknown): string {
  if (raw == null) return "";
  return String(raw).trim().toLowerCase();
}

export function isInstagramOrTikTok(platform: unknown): boolean {
  const p = normalizeSocialPlatform(platform);
  return p === "instagram" || p === "tiktok";
}

/** `instagram:handle` or null when not IG/TikTok / empty. */
export function socialAccountKey(platform: unknown, username: unknown): string | null {
  if (!isInstagramOrTikTok(platform)) return null;
  const user = normalizeSocialUsername(username);
  if (!user) return null;
  return `${normalizeSocialPlatform(platform)}:${user}`;
}

export function collectSocialKeysFromAccounts(accounts: unknown): string[] {
  if (!Array.isArray(accounts)) return [];
  const keys: string[] = [];
  for (const item of accounts) {
    if (!item || typeof item !== "object") continue;
    const src = item as Record<string, unknown>;
    const key = socialAccountKey(src.platform, src.username);
    if (key) keys.push(key);
  }
  return keys;
}

/**
 * Approved influencers that share an Instagram/TikTok username with another approved row.
 */
export function findApprovedDuplicateIds(
  rows: Array<{ id: string; accounts?: unknown; approved?: boolean | null }>
): Set<string> {
  const keyToIds = new Map<string, string[]>();
  for (const row of rows) {
    if (row.approved !== true) continue;
    const id = String(row.id || "");
    if (!id) continue;
    for (const key of collectSocialKeysFromAccounts(row.accounts)) {
      const list = keyToIds.get(key) || [];
      if (!list.includes(id)) list.push(id);
      keyToIds.set(key, list);
    }
  }
  const dupes = new Set<string>();
  for (const ids of keyToIds.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) dupes.add(id);
  }
  return dupes;
}

/** True when any of `candidateAccounts` matches an existing row's IG/TikTok username. */
export function accountsConflictWithExisting(
  candidateAccounts: unknown,
  existingRows: Array<{ id?: string; accounts?: unknown }>,
  excludeId?: string | null
): boolean {
  const candidateKeys = new Set(collectSocialKeysFromAccounts(candidateAccounts));
  if (candidateKeys.size === 0) return false;
  for (const row of existingRows) {
    if (excludeId && row.id != null && String(row.id) === String(excludeId)) continue;
    for (const key of collectSocialKeysFromAccounts(row.accounts)) {
      if (candidateKeys.has(key)) return true;
    }
  }
  return false;
}
