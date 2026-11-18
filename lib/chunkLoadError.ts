/** Shared helpers for stale Next.js assets after a deploy (ChunkLoadError). */

export const CHUNK_RELOAD_KEY = "influo-chunk-reload";

export function isStaleChunkError(message: string): boolean {
  return /ChunkLoadError|Loading chunk |Loading CSS chunk |Failed to fetch dynamically imported module|\/_next\/static\//i.test(
    String(message || "")
  );
}

/** Record a single auto-reload for this tab. Returns false if one already ran. */
export function takeChunkReloadToken(): boolean {
  try {
    if (typeof sessionStorage === "undefined") return false;
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/** Call after a successful load so a later deploy can auto-reload again. */
export function clearChunkReloadToken(): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    /* ignore */
  }
}
