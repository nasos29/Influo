/** Stale-while-revalidate + single-flight for expensive admin stats payloads. */

export const STATS_SWR_MS = 5 * 60_000;

type Entry<T> = {
  payload?: T;
  fetchedAt: number;
  inflight: Promise<T> | null;
};

export type StatsSwrCache<T> = {
  serve: (compute: () => Promise<T>) => Promise<T>;
  peek: () => T | undefined;
};

export function createStatsSwrCache<T>(freshMs = STATS_SWR_MS): StatsSwrCache<T> {
  let entry: Entry<T> = { fetchedAt: 0, inflight: null };

  async function runCompute(compute: () => Promise<T>): Promise<T> {
    if (entry.inflight) return entry.inflight;
    const work = compute();
    entry.inflight = work;
    try {
      const payload = await work;
      entry = { payload, fetchedAt: Date.now(), inflight: null };
      return payload;
    } catch (err) {
      entry = { payload: entry.payload, fetchedAt: entry.fetchedAt, inflight: null };
      throw err;
    }
  }

  return {
    peek: () => entry.payload,
    async serve(compute) {
      const now = Date.now();
      const hasPayload = entry.payload !== undefined;
      if (hasPayload && now - entry.fetchedAt < freshMs) {
        return entry.payload as T;
      }
      if (hasPayload) {
        if (!entry.inflight) void runCompute(compute).catch(() => {});
        return entry.payload as T;
      }
      if (entry.inflight) return entry.inflight;
      return runCompute(compute);
    },
  };
}