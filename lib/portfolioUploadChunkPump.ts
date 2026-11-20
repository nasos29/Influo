/** Parallel chunk upload index scheduler (one index sent at most once until completed). */

export type ChunkPumpState = {
  totalChunks: number;
  parallel: number;
  completed: Set<number>;
  inflight: Set<number>;
  nextIndex: number;
};

export function createChunkPumpState(
  totalChunks: number,
  parallel: number,
  contiguousCompleteFromIndex = 0
): ChunkPumpState {
  const completed = new Set<number>();
  for (let i = 0; i < contiguousCompleteFromIndex && i < totalChunks; i++) {
    completed.add(i);
  }
  return {
    totalChunks,
    parallel,
    completed,
    inflight: new Set<number>(),
    nextIndex: contiguousCompleteFromIndex,
  };
}

export function markChunkComplete(state: ChunkPumpState, index: number): void {
  state.completed.add(index);
  state.inflight.delete(index);
}

export function markChunkFailed(state: ChunkPumpState, index: number): void {
  state.inflight.delete(index);
}

/** Next chunk index to send, or null when at parallelism cap or all done/in-flight. */
export function pickNextChunkIndex(state: ChunkPumpState): number | null {
  if (state.inflight.size >= state.parallel) return null;
  while (state.nextIndex < state.totalChunks) {
    const idx = state.nextIndex++;
    if (state.completed.has(idx) || state.inflight.has(idx)) continue;
    state.inflight.add(idx);
    return idx;
  }
  return null;
}

export function chunksRemaining(state: ChunkPumpState): boolean {
  return state.completed.size < state.totalChunks;
}