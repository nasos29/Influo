let logoutEpoch = 0;
const stops = new Set<() => void>();

/** Current logout generation. Heartbeats captured before a logout must not write again. */
export function presenceLogoutEpoch(): number {
  return logoutEpoch;
}

export function presenceStillCurrent(epoch: number): boolean {
  return epoch === logoutEpoch;
}

/** Register a synchronous stop (clear the heartbeat interval). Returns unregister. */
export function registerPresenceStop(stop: () => void): () => void {
  stops.add(stop);
  return () => {
    stops.delete(stop);
  };
}

/**
 * Call this before sign-out. Stops every registered heartbeat immediately, then
 * advances the epoch so a late unmount does not write presence after the session is gone.
 * A later login mounts a new effect and captures the new epoch.
 */
export function beginPresenceLogout(): number {
  logoutEpoch += 1;
  const pending = [...stops];
  stops.clear();
  for (const stop of pending) {
    try {
      stop();
    } catch {
      /* one failed stop must not leave the others running */
    }
  }
  return logoutEpoch;
}
