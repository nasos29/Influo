/** Session keys for returning from a public profile to the directory with filters/scroll. */

const RETURN_KEY = "influo:directory-return";
const SCROLL_KEY = "influo:directory-return-scroll";

type DirectoryReturn = {
  path: string;
  scrollY: number;
  at: number;
};

function isDirectoryPath(path: string): boolean {
  return /(?:^|\/)(?:en\/)?directory(?:\/|\?|#|$)/.test(path);
}

/** Call when leaving the directory for a profile so Back can restore filters + scroll. */
export function rememberDirectoryReturn(): void {
  if (typeof window === "undefined") return;
  try {
    const path = `${window.location.pathname}${window.location.search}`;
    if (!isDirectoryPath(path)) return;
    const payload: DirectoryReturn = {
      path,
      scrollY: window.scrollY || 0,
      at: Date.now(),
    };
    sessionStorage.setItem(RETURN_KEY, JSON.stringify(payload));
  } catch {
    /* private mode / quota */
  }
}

const RETURN_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** Path (+ query) to push; also stashes scroll for `restoreDirectoryScroll`. */
export function consumeDirectoryReturnPath(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as DirectoryReturn;
    if (!data?.path || typeof data.path !== "string" || !isDirectoryPath(data.path)) return null;
    if (typeof data.at === "number" && Date.now() - data.at > RETURN_MAX_AGE_MS) {
      sessionStorage.removeItem(RETURN_KEY);
      return null;
    }
    if (typeof data.scrollY === "number" && Number.isFinite(data.scrollY) && data.scrollY > 0) {
      sessionStorage.setItem(SCROLL_KEY, String(Math.round(data.scrollY)));
    }
    return data.path;
  } catch {
    return null;
  }
}

/** Same-origin directory URL from document.referrer (includes query). */
export function directoryPathFromReferrer(): string | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  try {
    const ref = document.referrer;
    if (!ref) return null;
    const u = new URL(ref);
    if (u.origin !== window.location.origin || !isDirectoryPath(u.pathname)) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

/** Restore scroll after navigating back to the directory. */
export function restoreDirectoryScroll(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(SCROLL_KEY);
    if (raw == null) return;
    sessionStorage.removeItem(SCROLL_KEY);
    const y = Number(raw);
    if (!Number.isFinite(y) || y <= 0) return;
    const apply = () => window.scrollTo(0, y);
    requestAnimationFrame(() => requestAnimationFrame(apply));
  } catch {
    /* ignore */
  }
}
