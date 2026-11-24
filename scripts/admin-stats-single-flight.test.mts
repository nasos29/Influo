import assert from "node:assert/strict";
import test from "node:test";
import { createStatsSwrCache } from "../lib/adminStatsSingleFlight.ts";

test("single-flight: concurrent callers share one in-flight promise", async () => {
  let runs = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const cache = createStatsSwrCache<string>(60_000);

  const compute = async () => {
    runs += 1;
    await gate;
    return "ok";
  };

  const p1 = cache.serve(compute);
  const p2 = cache.serve(compute);
  release();
  const [a, b] = await Promise.all([p1, p2]);
  assert.equal(a, "ok");
  assert.equal(b, "ok");
  assert.equal(runs, 1);
});

test("stale-while-revalidate: returns last good payload without awaiting refresh", async () => {
  let runs = 0;
  const cache = createStatsSwrCache<number>(1);

  await cache.serve(async () => {
    runs += 1;
    return 10;
  });

  await new Promise((r) => setTimeout(r, 10));
  const stale = cache.peek();
  assert.equal(stale, 10);

  const immediate = await cache.serve(async () => {
    runs += 1;
    return 99;
  });
  assert.equal(immediate, 10);
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(runs >= 2);
  assert.equal(cache.peek(), 99);
});