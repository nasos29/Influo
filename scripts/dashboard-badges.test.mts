import assert from "node:assert/strict";
import test from "node:test";
import {
  companySeenKey,
  conversationSeenKey,
  countNewerThan,
  countUnseenIds,
  latestIso,
  readIdList,
  readStamp,
  writeIdList,
  writeStamp,
  type SeenStore,
} from "../lib/dashboardBadges.ts";

function memoryStore(): SeenStore & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = value;
    },
  };
}

test("opening conversations hides current threads and a later message counts again", () => {
  const store = memoryStore();
  const times = ["2026-10-18T10:00:00.000Z", "2026-10-18T12:00:00.000Z"];
  assert.equal(countNewerThan(times, null), 2);
  const openedAt = latestIso(times, "2026-10-18T09:00:00.000Z");
  writeStamp(store, conversationSeenKey("admin-1"), openedAt);
  assert.equal(countNewerThan(times, readStamp(store, conversationSeenKey("admin-1"))), 0);
  assert.equal(
    countNewerThan([...times, "2026-10-18T12:05:00.000Z"], readStamp(store, conversationSeenKey("admin-1"))),
    1
  );
  assert.equal(countNewerThan(times, readStamp(store, conversationSeenKey("admin-2"))), 2);
});

test("opening companies hides the unverified brands already on screen", () => {
  const store = memoryStore();
  const pending = ["brand-a", "brand-b"];
  assert.equal(countUnseenIds(pending, []), 2);
  writeIdList(store, companySeenKey("admin-1"), pending);
  assert.equal(countUnseenIds(pending, readIdList(store, companySeenKey("admin-1"))), 0);
  assert.equal(countUnseenIds([...pending, "brand-c"], readIdList(store, companySeenKey("admin-1"))), 1);
});
