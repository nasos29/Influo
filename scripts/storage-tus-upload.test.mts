import assert from "node:assert/strict";
import test from "node:test";
import {
  SUPABASE_TUS_CHUNK_BYTES,
  tusChunkCount,
  tusChunkLengthAtOffset,
} from "../lib/supabaseTusChunks.ts";

test("TUS chunk lengths follow 6 MiB rule", () => {
  assert.equal(SUPABASE_TUS_CHUNK_BYTES, 6 * 1024 * 1024);

  const one = SUPABASE_TUS_CHUNK_BYTES;
  const total = one * 2 + 123;
  assert.equal(tusChunkLengthAtOffset(0, total), one);
  assert.equal(tusChunkLengthAtOffset(one, total), one);
  assert.equal(tusChunkLengthAtOffset(one * 2, total), 123);
  assert.equal(tusChunkLengthAtOffset(total, total), 0);

  assert.equal(tusChunkCount(one), 1);
  assert.equal(tusChunkCount(one + 1), 2);
  assert.equal(tusChunkCount(total), 3);
});