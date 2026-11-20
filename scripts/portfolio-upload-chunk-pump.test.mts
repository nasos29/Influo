import assert from "node:assert/strict";
import test from "node:test";
import {
  chunksRemaining,
  createChunkPumpState,
  markChunkComplete,
  pickNextChunkIndex,
} from "../lib/portfolioUploadChunkPump.ts";

test("chunk pump sends each index at most once with slow parallel slot 0", async () => {
  const total = 5;
  const parallel = 2;
  const state = createChunkPumpState(total, parallel, 0);
  const sent: number[] = [];
  const inflight = new Map<number, Promise<void>>();

  const send = (index: number) => {
    sent.push(index);
    return new Promise<void>((resolve) => {
      const delay = index === 0 ? 40 : 5;
      setTimeout(() => {
        markChunkComplete(state, index);
        inflight.delete(index);
        resolve();
      }, delay);
    });
  };

  const pump = async () => {
    for (;;) {
      const idx = pickNextChunkIndex(state);
      if (idx === null) break;
      inflight.set(idx, send(idx));
    }
  };

  while (chunksRemaining(state) || inflight.size > 0) {
    await pump();
    if (inflight.size > 0) await Promise.race(inflight.values());
    if (inflight.size === 0 && chunksRemaining(state)) await pump();
  }

  assert.deepEqual(sent.sort((a, b) => a - b), [0, 1, 2, 3, 4]);
  assert.equal(new Set(sent).size, total);
});