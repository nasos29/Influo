import { isPermanentAccountMissingError, normalizeSocialHandle } from "@/lib/socialAccountMissing";

export type WrongUsernameHandle = { platform: string; handle: string };

export function collectPermanentMissingHandles(
  accounts: Array<{ platform?: string; username?: string; ok?: boolean; error?: string }>
): WrongUsernameHandle[] {
  const out: WrongUsernameHandle[] = [];
  for (const acc of accounts) {
    if (acc.ok) continue;
    const err = String(acc.error || "");
    if (!isPermanentAccountMissingError(err)) continue;
    const platform = String(acc.platform || "")
      .trim()
      .toLowerCase();
    const handle = normalizeSocialHandle(String(acc.username || ""));
    if (platform && handle) out.push({ platform, handle });
  }
  return out;
}

/** Hold applies only when at least one account failed with a clear permanent missing-handle error. */
export function shouldSetWrongUsernameHold(
  accounts: Array<{ platform?: string; username?: string; ok?: boolean; error?: string }>
): boolean {
  return collectPermanentMissingHandles(accounts).length > 0;
}

/** Full handle snapshot at hold time (all scraped accounts), matched against DB accounts when listing. */
export function handlesSnapshotFromScrapeAccounts(
  accounts: Array<{ platform?: string; username?: string; ok?: boolean; error?: string }>
): WrongUsernameHandle[] {
  return accounts
    .map((a) => ({
      platform: String(a.platform || "")
        .trim()
        .toLowerCase(),
      handle: normalizeSocialHandle(String(a.username || "")),
    }))
    .filter((h) => h.platform && h.handle);
}

export function currentHandlesFromAccounts(
  accounts: Array<{ platform: string; username: string }>
): WrongUsernameHandle[] {
  return accounts
    .map((a) => ({
      platform: String(a.platform || "")
        .trim()
        .toLowerCase(),
      handle: normalizeSocialHandle(a.username),
    }))
    .filter((h) => h.platform && h.handle);
}

function sortHandles(handles: WrongUsernameHandle[]): WrongUsernameHandle[] {
  return [...handles].sort((x, y) => {
    const kx = `${x.platform}\0${x.handle}`;
    const ky = `${y.platform}\0${y.handle}`;
    return kx < ky ? -1 : kx > ky ? 1 : 0;
  });
}

export function parseWrongUsernameHandlesSnapshot(raw: unknown): WrongUsernameHandle[] | null {
  if (!Array.isArray(raw)) return null;
  const parsed: WrongUsernameHandle[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const platform = String((item as { platform?: string }).platform || "")
      .trim()
      .toLowerCase();
    const handle = normalizeSocialHandle(String((item as { handle?: string }).handle || ""));
    if (platform && handle) parsed.push({ platform, handle });
  }
  return parsed.length ? parsed : null;
}

export function handlesMatchSnapshot(
  current: WrongUsernameHandle[],
  snapshot: WrongUsernameHandle[] | null | undefined
): boolean {
  if (!snapshot?.length) return false;
  const a = sortHandles(current);
  const b = sortHandles(snapshot);
  if (a.length !== b.length) return false;
  return a.every((h, i) => h.platform === b[i].platform && h.handle === b[i].handle);
}

export function hasProfileChangeAfterHold(
  heldAtIso: string,
  profileChangeTimestamps: string[]
): boolean {
  const heldAt = new Date(heldAtIso).getTime();
  if (!Number.isFinite(heldAt)) return false;
  return profileChangeTimestamps.some((ts) => {
    const t = new Date(ts).getTime();
    return Number.isFinite(t) && t > heldAt;
  });
}

/**
 * ApproveNew list filter: skip held creators still on the same handles with no profile edit after hold.
 */
export function shouldSkipWrongUsernameHeldCreator(input: {
  wrong_username_held_at: string | null | undefined;
  wrong_username_handles: unknown;
  accounts: Array<{ platform: string; username: string }>;
  profileChangeTimestamps: string[];
}): boolean {
  const heldAt = input.wrong_username_held_at
    ? String(input.wrong_username_held_at).trim()
    : "";
  if (!heldAt) return false;

  if (hasProfileChangeAfterHold(heldAt, input.profileChangeTimestamps)) {
    return false;
  }

  const snapshot = parseWrongUsernameHandlesSnapshot(input.wrong_username_handles);
  const current = currentHandlesFromAccounts(input.accounts);
  if (!handlesMatchSnapshot(current, snapshot)) {
    return false;
  }

  return true;
}