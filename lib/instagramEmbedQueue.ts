/**
 * Limit concurrent Instagram embed iframe loads (rate-limit friendly).
 * Max 2 loading at once; next starts when a slot is released (onLoad or 4s timeout).
 */

const MAX_CONCURRENT = 2;

type Waiter = {
  grant: () => void;
  cancelled: boolean;
};

let active = 0;
const waiters: Waiter[] = [];

function pump() {
  while (active < MAX_CONCURRENT && waiters.length > 0) {
    const next = waiters.shift();
    if (!next || next.cancelled) continue;
    active += 1;
    next.grant();
  }
}

/**
 * Request a loading slot. Calls `onGranted` when a slot is available.
 * Returns a cancel function (does not release an already-granted slot).
 */
export function requestInstagramEmbedSlot(onGranted: () => void): () => void {
  const waiter: Waiter = {
    cancelled: false,
    grant: onGranted,
  };
  waiters.push(waiter);
  pump();
  return () => {
    waiter.cancelled = true;
    const idx = waiters.indexOf(waiter);
    if (idx >= 0) waiters.splice(idx, 1);
  };
}

/** Release a previously granted loading slot so the next waiter can start. */
export function releaseInstagramEmbedSlot() {
  active = Math.max(0, active - 1);
  pump();
}

/** @internal test helper */
export function __resetInstagramEmbedQueueForTests() {
  active = 0;
  waiters.length = 0;
}
