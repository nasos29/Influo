/** Client-side cache for /api/influencers/public results (browser Back on /directory). */

const MODULE_CACHE = new Map<string, DirectoryListCacheEntry>();
const SESSION_PREFIX = "influo:directory-list:";
const MAX_AGE_MS = 30 * 60_000;
const MAX_SESSION_ENTRIES = 12;

export type DirectoryListCacheEntry = {
  influencers: unknown[];
  total: number;
  relaxedMax: number | null;
  at: number;
};

function sessionKey(queryString: string): string {
  return `${SESSION_PREFIX}${queryString}`;
}

function readSession(queryString: string): DirectoryListCacheEntry | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(sessionKey(queryString));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DirectoryListCacheEntry;
    if (!parsed || typeof parsed.at !== "number" || !Array.isArray(parsed.influencers)) return null;
    if (Date.now() - parsed.at > MAX_AGE_MS) {
      sessionStorage.removeItem(sessionKey(queryString));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(queryString: string, entry: DirectoryListCacheEntry): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(sessionKey(queryString), JSON.stringify(entry));
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(SESSION_PREFIX)) keys.push(k);
    }
    if (keys.length > MAX_SESSION_ENTRIES) {
      const sorted = keys
        .map((k) => {
          try {
            const raw = sessionStorage.getItem(k);
            const at = raw ? (JSON.parse(raw) as { at?: number }).at : 0;
            return { k, at: typeof at === "number" ? at : 0 };
          } catch {
            return { k, at: 0 };
          }
        })
        .sort((a, b) => a.at - b.at);
      for (const drop of sorted.slice(0, sorted.length - MAX_SESSION_ENTRIES)) {
        sessionStorage.removeItem(drop.k);
      }
    }
  } catch {
    /* quota / private mode */
  }
}

export function readDirectoryListCache(queryString: string): DirectoryListCacheEntry | null {
  const fromModule = MODULE_CACHE.get(queryString);
  if (fromModule && Date.now() - fromModule.at <= MAX_AGE_MS) return fromModule;
  if (fromModule) MODULE_CACHE.delete(queryString);

  const fromSession = readSession(queryString);
  if (fromSession) {
    MODULE_CACHE.set(queryString, fromSession);
    return fromSession;
  }
  return null;
}

export function writeDirectoryListCache(
  queryString: string,
  payload: Omit<DirectoryListCacheEntry, "at">
): void {
  const entry: DirectoryListCacheEntry = { ...payload, at: Date.now() };
  MODULE_CACHE.set(queryString, entry);
  writeSession(queryString, entry);
}